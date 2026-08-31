declare module 'relationship.js' {
  type RelationshipOptions = {
    text: string
    target?: string
    sex?: -1 | 0 | 1
    type?: 'default' | 'chain' | 'pair'
    reverse?: boolean
    mode?: string
    optimal?: boolean
  }

  type Relationship = (options: RelationshipOptions | string) => string[]

  const relationship: Relationship
  export default relationship
}
