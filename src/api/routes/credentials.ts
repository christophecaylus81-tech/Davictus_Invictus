import { Router } from 'express'
import type { PgCredentialRepository } from '../../infra/repositories/PgCredentialRepository'

export function credentialsRouter(repo: PgCredentialRepository): Router {
  const r = Router()

  // Liste (sans les valeurs)
  r.get('/', async (_req, res) => {
    const list = await repo.list()
    res.json(list)
  })

  // Créer / mettre à jour
  r.put('/:key', async (req, res) => {
    const { key } = req.params
    const { value, label, category, description } = req.body as {
      value?: string
      label?: string
      category?: 'api' | 'oauth' | 'webhook' | 'other'
      description?: string
    }

    if (!value || !label) {
      res.status(400).json({ error: 'value et label requis' })
      return
    }

    const credential = await repo.set(key, value, label, category ?? 'api', description)
    res.json(credential)
  })

  // Supprimer
  r.delete('/:key', async (req, res) => {
    const deleted = await repo.delete(req.params.key)
    res.json({ deleted })
  })

  // Tester qu'une clé existe (sans révéler la valeur)
  r.get('/:key/exists', async (req, res) => {
    const value = await repo.get(req.params.key)
    res.json({ exists: value !== null })
  })

  return r
}
