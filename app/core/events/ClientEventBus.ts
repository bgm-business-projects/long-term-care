type Handler<T = void> = (payload: T) => void

const handlers = new Map<string, Set<Handler<any>>>()

export function onClientEvent<T = void>(event: string, fn: Handler<T>): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set())
  handlers.get(event)!.add(fn)
  return () => { handlers.get(event)?.delete(fn) }
}

export function emitClientEvent<T = void>(event: string, payload?: T): void {
  handlers.get(event)?.forEach(fn => fn(payload))
}
