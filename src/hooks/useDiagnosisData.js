import { useEffect, useState } from 'react'
import client from '../api/client'

export default function useDiagnosisData(taskId, artworkId) {
  const [tasks, setTasks] = useState([])
  const [artworks, setArtworks] = useState([])
  const [context, setContext] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/tasks').then(({ data }) => {
      setTasks(data)
    }).catch(err => console.error('Failed to load tasks:', err))
  }, [])

  useEffect(() => {
    if (taskId) {
      client.get(`/artworks?taskId=${taskId}`).then(({ data }) => {
        setArtworks(data)
        if (!artworkId && data[0]) {
          loadContext(data[0].id)
        }
      }).catch(err => console.error('Failed to load artworks:', err))
        .finally(() => setLoading(false))
    }
  }, [taskId, artworkId])

  useEffect(() => {
    if (artworkId) {
      loadContext(artworkId)
    }
  }, [artworkId])

  const loadContext = async (id) => {
    try {
      const { data } = await client.get(`/artworks/${id}/context`)
      setContext(data)
    } catch (err) {
      console.error('Failed to load artwork context:', err)
    }
  }

  const selectArtwork = (id) => {
    loadContext(id)
  }

  const submitReview = async (artworkId, comment, override = true) => {
    try {
      await client.post(`/artworks/${artworkId}/review`, { comment, override })
      loadContext(artworkId)
      if (taskId) {
        const { data } = await client.get(`/artworks?taskId=${taskId}`)
        setArtworks(data)
      }
    } catch (err) {
      console.error('Failed to submit review:', err)
    }
  }

  return { tasks, artworks, context, loading, selectArtwork, submitReview }
}
