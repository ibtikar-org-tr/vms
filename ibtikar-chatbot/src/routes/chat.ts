import { Hono } from 'hono'
import { answerWithContext } from '../services/llm'
import { retrieveContextForQuestion } from '../services/rag'

const chat = new Hono<{ Bindings: CloudflareBindings }>()

interface ChatRequestBody {
  message?: string
  question?: string
}

chat.post('/', async (c) => {
  let body: ChatRequestBody

  try {
    body = await c.req.json<ChatRequestBody>()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }

  const question = (body.message || body.question || '').trim()
  if (!question) {
    return c.json({ error: 'Provide a non-empty "message" (or "question")' }, 400)
  }

  try {
    const { context, matchCount } = await retrieveContextForQuestion(c.env, question)
    const { reply, model } = await answerWithContext(c.env, question, context)

    return c.json({
      reply,
      model,
      retrieval: {
        matchCount,
        hasContext: Boolean(context),
      },
    })
  } catch (error) {
    console.error('[chat] failed', error)
    return c.json({ error: 'Failed to answer with Workers AI / Vectorize' }, 502)
  }
})

export default chat
