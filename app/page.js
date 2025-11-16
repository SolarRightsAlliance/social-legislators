'use client';

import { useState } from 'react';

export default function Home() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [legislators, setLegislators] = useState([]);
  const [baseText, setBaseText] = useState(
    'Hi {{handles}}, please vote NO on SB 123 to protect rooftop solar. #ProtectSolar'
  );

  async function handleLookup(e) {
    e.preventDefault();
    setError('');
    setLegislators([]);

    if (!address.trim()) {
      setError('Please enter an address.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/lookup-legislators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Lookup failed.');
        return;
      }

      setLegislators(data.legislators || []);
    } catch (err) {
      console.error(err);
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function buildHandles(platform) {
    return legislators
      .map((leg) => {
        const social = (leg.social || []).find((s) => s.platform === platform);
        if (platform === 'twitter' && social?.handle) {
          return social.handle;
        }
        // Fallback if no handle: just use their name
        return leg.name;
      })
      .join(' ');
  }

  function messageFor(platform) {
    const handles = buildHandles(platform);
    return baseText.replace('{{handles}}', handles);
  }

  function shareOnTwitter() {
    const text = messageFor('twitter');
    const url = new URL('https://twitter.com/intent/tweet');
    url.searchParams.set('text', text);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  async function copyMessageForFacebook() {
    const text = messageFor('twitter'); // same text works
    try {
      await navigator.clipboard.writeText(text);
      alert('Message copied. Paste it into Facebook/Instagram!');
    } catch (err) {
      console.error(err);
      alert('Could not copy automatically. You can select and copy from the preview box.');
    }
  }

return (
  <main
    style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '2rem',
      fontFamily: 'system-ui',
      backgroundColor: '#f3f4f6',
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 700,
        backgroundColor: 'white',
        borderRadius: 8,
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
        padding: '2rem',
      }}
    >

      <h1>Tag Your State Legislators</h1>
      <p>Enter your address to find your state legislators and tag them on social media.</p>

      <form onSubmit={handleLookup} style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem' }}>
          Address (street, city, state, ZIP)
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: 4,
          }}
          placeholder="123 Main St, Sacramento, CA 95814"
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 4,
            border: 'none',
            backgroundColor: '#2563eb',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Looking up...' : 'Find My Legislators'}
        </button>
      </form>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

{legislators.length > 0 && (
  <>
    <h2>Your State Legislators</h2>
    <p style={{ fontSize: '0.9rem', color: '#555', marginTop: '-0.25rem' }}>
      When a social media handle isn&apos;t available, we&apos;ll use the legislator&apos;s name instead.
    </p>
    <ul>
      {legislators.map((leg) => {

              const chamberLabel = leg.chamberLabel || leg.chamber;
              return (
                <li key={leg.id} style={{ marginBottom: '0.5rem' }}>
                  <strong>{leg.name}</strong> ({leg.party || 'Unknown'}) – {chamberLabel} district{' '}
                  {leg.district}
                  {leg.social && leg.social.length > 0 && (
                    <div style={{ fontSize: '0.9rem', color: '#555' }}>
                      Social:{' '}
                      {leg.social.map((s) => (
                        <span key={s.platform} style={{ marginRight: '0.5rem' }}>
                          {s.platform}: {s.handle ? s.handle : s.url ? s.url : '(no handle)'}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <h2 style={{ marginTop: '1.5rem' }}>Edit Your Message</h2>
          <p>
            Use <code>{'{{handles}}'}</code> where you want the legislator tags to appear.
          </p>
          <textarea
            value={baseText}
            onChange={(e) => setBaseText(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: 4,
              border: '1px solid #ccc',
              marginTop: '0.5rem',
            }}
          />

          <h3 style={{ marginTop: '1rem' }}>Preview (Twitter/X)</h3>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 4,
              padding: '0.75rem',
              backgroundColor: '#f9fafb',
              whiteSpace: 'pre-wrap',
            }}
          >
            {messageFor('twitter')}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={shareOnTwitter}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 4,
                border: 'none',
                backgroundColor: '#0f172a',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Share on X / Twitter
            </button>
            <button
              onClick={copyMessageForFacebook}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 4,
                border: '1px solid #ccc',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              Copy for Facebook / Instagram
            </button>
          </div>
        </>
           )}
    </div>
  </main>
  );
}
