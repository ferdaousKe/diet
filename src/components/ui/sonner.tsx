import type * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="bottom-center"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--foreground)",
          "--normal-text": "var(--background)",
          "--normal-border": "var(--foreground)",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      toastOptions={{ style: { fontFamily: "var(--font-sans)", fontWeight: 600 } }}
      {...props}
    />
  )
}

export { Toaster }
