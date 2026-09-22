import { useState } from 'react'

// Base URL of your Go backend
const API_BASE = 'localhost:8080'

function App() {
  const [postText, setPostText] = useState('')
  const [postResult, setPostResult] = useState(null)

  const [items, setItems] = useState([])

  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState(null)

  const [error, setError] = useState('')

  async function handlePost() {
    setError('')
    setPostResult(null)
    try {
      const res = await fetch(API_BASE + '/', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: postText, // raw text, not JSON
      })
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      const data = await res.json()
      setPostResult(data)
    } catch (err) {
      setError('POST failed: ' + err.message)
    }
  }

  async function handleGetAll() {
    setError('')
    try {
      const res = await fetch(API_BASE + '/')
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      const data = await res.json()
      setItems(data)
    } catch (err) {
      setError('GET all failed: ' + err.message)
    }
  }

  async function handleGetById() {
    setError('')
    setLookupResult(null)
    try {
      const res = await fetch(API_BASE + '/' + lookupId)
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      const data = await res.json()
      setLookupResult(data)
    } catch (err) {
      setError('GET by id failed: ' + err.message)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Backend Demo</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <section style={{ marginBottom: '2rem' }}>
        <h2>Create item (POST)</h2>
        <textarea
          rows={3}
          style={{ width: '100%' }}
          placeholder="test"
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
        />
        <br />
        <button onClick={handlePost}>Send</button>
        {postResult && (
          <pre>{JSON.stringify(postResult, null, 2)}</pre>
        )}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>All items (GET)</h2>
        <button onClick={handleGetAll}>Refresh list</button>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              #{item.id}: {item.content}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Get item by id</h2>
        <input
          type="text"
          placeholder="id"
          value={lookupId}
          onChange={(e) => setLookupId(e.target.value)}
        />
        <button onClick={handleGetById}>Look up</button>
        {lookupResult && (
          <pre>{JSON.stringify(lookupResult, null, 2)}</pre>
        )}
      </section>
    </div>
  )
}

export default App
