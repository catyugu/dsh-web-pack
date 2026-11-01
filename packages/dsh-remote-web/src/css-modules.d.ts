declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

/** A plain stylesheet imported as text: the row injects it into its own tag. */
declare module '*.css' {
  const text: string
  export default text
}
