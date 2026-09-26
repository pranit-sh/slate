import { type ComponentProps, useState } from "react"
import { Globe2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FaviconProps extends Omit<ComponentProps<"img">, "alt" | "src"> {
  src?: string
  fallbackClassName?: string
}

export function Favicon({
  src,
  className,
  fallbackClassName,
  onError,
  ...props
}: FaviconProps) {
  const [failedSrc, setFailedSrc] = useState("")

  if (!src || src === failedSrc) {
    return <Globe2 className={cn("text-muted-foreground", className, fallbackClassName)} />
  }

  return (
    <img
      {...props}
      src={src}
      alt=""
      className={cn("rounded-sm object-contain", className)}
      onError={(event) => {
        setFailedSrc(src)
        onError?.(event)
      }}
    />
  )
}