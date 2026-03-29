export interface PromptSection {
  /** Filename stem (without extension), for logging */
  id: string
  /** Parsed frontmatter tags */
  tags: string[]
  /** Sort order from frontmatter */
  order: number
  /** The markdown body (everything below the frontmatter) */
  body: string
}

export type PromptRole = 'employee' | 'admin'

export interface DataContext {
  [key: string]: string | number | boolean
}
