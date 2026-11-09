import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "cn";

export function Avatar({
  name,
  image,
  className,
}: {
  name: string;
  image: string | null;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root className={cn("avatar", className)}>
      {image !== null && <AvatarPrimitive.Image src={image} alt="" referrerPolicy="no-referrer" />}
      <AvatarPrimitive.Fallback delay={300}>{name.slice(0, 1)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
