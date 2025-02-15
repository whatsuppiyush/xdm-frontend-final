import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface HeadingProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  iconColor?: string;
  bgColor?: string;
}

export const Heading = ({
  title,
  description,
  icon: Icon,
  iconColor,
  bgColor,
}: HeadingProps) => {
  return (
    <div
      className="px-4 lg:px-8 flex items-center gap-x-3 mb-8"
      data-oid="3ucjg1p"
    >
      {Icon && (
        <div className={cn("p-2 w-fit rounded-md", bgColor)} data-oid="b.z71dx">
          <Icon className={cn("w-10 h-10", iconColor)} data-oid="r76p_d3" />
        </div>
      )}
      <div data-oid="nguj9wj">
        <h2 className="text-3xl font-bold" data-oid="6dj3.w3">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground" data-oid="vku4hu8">
          {description}
        </p>
      </div>
    </div>
  );
};
