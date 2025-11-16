// app/api/lookup-legislators/route.js

// Map of nicer chamber names by state
const CHAMBER_LABELS = {
  California: { upper: 'State Senate', lower: 'State Assembly' },
  Nevada: { upper: 'State Senate', lower: 'Assembly' },
  'New Jersey': { upper: 'State Senate', lower: 'General Assembly' },
  'New York': { upper: 'State Senate', lower: 'Assembly' },
  Wisconsin: { upper: 'State Senate', lower: 'State Assembly' },

  Maryland: { upper: 'State Senate', lower: 'House of Delegates' },
  Virginia: { upper: 'State Senate', lower: 'House of Delegates' },
  'West Virginia': { upper: 'State Senate', lower: 'House of Delegates' },

  // Nebraska has a unicameral legislature
  Nebraska: {
    upper: 'Unicameral Legislature',
    lower: 'Unicameral Legislature',
  },
  // You can add more states here over time as needed
};

function getChamberLabel(stateName, chamber) {
  const stateLabels = CHAMBER_LABELS[stateName];
  if (stateLabels && stateLabels[chamber]) return stateLabels[chamber];

  // sensible defaults for states we haven't customized yet
  if (chamber === 'upper') return 'State Senate';
  if (chamber === 'lower') return 'State House of Representatives';
  return chamber || '';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const address = body.address;

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1) Geocode with OpenCage (server-side, keys hidden from browser)
    const geoUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
      address
    )}&key=${process.env.OPENCAGE_API_KEY}&countrycode=us&limit=1`;

    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      console.error('OpenCage error', geoRes.status);
      return new Response(
        JSON.stringify({ error: 'Error calling geocoding service' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const geoData = await geoRes.json();
    const first = geoData.results?.[0];
    if (!first) {
      return new Response(
        JSON.stringify({ error: 'Could not geocode that address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const lat = first.geometry.lat;
    const lng = first.geometry.lng;

    // 2) Get legislators from Open States people.geo
const osUrl = `https://v3.openstates.org/people.geo?lat=${lat}&lng=${lng}&apikey=${process.env.OPENSTATES_API_KEY}`;

    const osRes = await fetch(osUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!osRes.ok) {
      console.error('OpenStates error', osRes.status);
      return new Response(
        JSON.stringify({ error: 'Error calling Open States' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const osData = await osRes.json();
    const people = osData.results || osData; // format depends on OpenStates
if ((people || []).length > 0) {
  console.log(
    'Sample OpenStates person:',
    JSON.stringify(people[0], null, 2)
  );
}

    const legislators = (people || [])
      // keep only *state* House / *state* Senate
      .filter((p) => {
        const chamber = p.current_role?.org_classification;
        const jurisdictionClass = p.jurisdiction?.classification;
        return (
          jurisdictionClass === 'state' &&
          (chamber === 'upper' || chamber === 'lower')
        );
      })
     .map((p) => {
    const links = p.links || [];
    const contactDetails = p.contact_details || [];
    const ids = p.ids || p.identifiers || []; // extra place social IDs may live

    // Extract social media links/handles
    const socials = [];

    // From links: look for twitter/facebook/instagram URLs
    for (const link of links) {
      const url = link.url || '';
      if (!url) continue;

      if (url.includes('twitter.com')) {
        socials.push({
          platform: 'twitter',
          url,
          handle: '@' + url.split('/').pop(),
        });
      } else if (url.includes('facebook.com')) {
        socials.push({
          platform: 'facebook',
          url,
        });
      } else if (url.includes('instagram.com')) {
        socials.push({
          platform: 'instagram',
          url,
        });
      }
    }

    // From contact_details, sometimes there's a twitter handle
    for (const c of contactDetails) {
      if (c.type === 'twitter' && c.value) {
        let handle = c.value.trim();
        if (!handle.startsWith('@')) handle = '@' + handle;
        socials.push({
          platform: 'twitter',
          handle,
        });
      }
    }

    // From ids / identifiers, common pattern: { scheme: 'twitter', identifier: 'handle' }
    for (const id of ids) {
      if (!id) continue;
      const scheme = id.scheme || id.identifier_scheme || '';
      if (scheme === 'twitter' && id.identifier) {
        let handle = id.identifier.trim();
        if (!handle.startsWith('@')) handle = '@' + handle;
        socials.push({
          platform: 'twitter',
          handle,
        });
      }
    }

    // Deduplicate socials by platform
    const byPlatform = {};
    for (const s of socials) {
      if (!byPlatform[s.platform]) {
        byPlatform[s.platform] = s;
      }
    }


        const mergedSocials = Object.values(byPlatform);

        const stateName = p.jurisdiction?.name ?? '';
        const chamber = p.current_role?.org_classification ?? '';

        return {
          id: p.id,
          name: p.name,
          state: stateName,
          chamber, // raw 'upper' / 'lower'
          chamberLabel: getChamberLabel(stateName, chamber),
          district: p.current_role?.district ?? '',
          party: p.current_party?.name ?? '',
          social: mergedSocials,
        };
      });

    // Note: we are NOT storing the address anywhere. Just returning legislators.
    return new Response(
      JSON.stringify({ legislators }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: 'Unexpected server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
