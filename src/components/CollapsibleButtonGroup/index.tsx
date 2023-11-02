import { Button, ButtonProps, Tooltip, TooltipProps } from "@arco-design/web-react";
import { IconMosaic } from "@arco-design/web-react/icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 } from "uuid";
import "./index.less";

export type CollapsibleButtonProps = {
  disabled?: boolean;
  size?: "mini" | "small" | "default" | "large";
  buttons?: (Omit<ButtonProps, "disabled" | "shape" | "size"> & { tooltip?: TooltipProps })[];
};

export default function CollapsibleButtonGroup(props: CollapsibleButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  const disabled = useMemo(() => props.disabled ?? false, [props.disabled]);
  const size = useMemo(() => props.size ?? "default", [props.size]);
  const padding = useMemo(() => {
    switch (size) {
      case "mini":
        return "0 6px";
      case "small":
        return "0 6px";
      case "default":
        return "0 8px";
      case "large":
        return "0 12px";
    }
  }, [size]);
  const buttons = useMemo(
    () =>
      props.buttons?.map((props, index) => {
        const key = v4();
        const button = (
          <Button
            {...props}
            key={key}
            shape="round"
            style={index === 0 ? { ...props.style, padding } : props.style}
            icon={index === 0 ? props.icon ?? <IconMosaic /> : props.icon}
            disabled={disabled}
            size={size}
          />
        );

        if (props.tooltip) {
          return (
            <Tooltip {...props.tooltip} key={key}>
              {button}
            </Tooltip>
          );
        } else {
          return button;
        }
      }),
    [disabled, padding, props.buttons, size]
  );

  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const con = container.current;
    const inn = inner.current;
    if (!con || !inn) return;

    const onMouseOver = () => {
      if (disabled) return;

      const { width } = inn.getBoundingClientRect();
      setWidth(width);
    };
    const onMouseLeave = () => {
      if (disabled) return;

      setWidth(undefined);
    };
    con.addEventListener("mouseover", onMouseOver);
    con.addEventListener("mouseleave", onMouseLeave);

    return () => {
      con.removeEventListener("mouseover", onMouseOver);
      con.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [disabled]);

  return (
    <div
      ref={container}
      style={{
        width: typeof width === "number" ? `${width}px` : undefined,
      }}
      className={`arco-btn-size-${size} arco-btn-icon-only arco-btn-shape-round collapse-btn`}
    >
      <div ref={inner} className="collapse-btn-inner">
        <Button.Group>{buttons}</Button.Group>
      </div>
    </div>
  );
}
