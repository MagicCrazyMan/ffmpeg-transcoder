import { Button, ButtonProps } from "@arco-design/web-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 } from "uuid";
import "./index.less";

export type CollapsibleButtonProps = {
  disabled?: boolean;
  size?: "mini" | "small" | "default" | "large";
  anchor: Omit<ButtonProps, "disabled" | "shape" | "size">;
  buttons?: Omit<ButtonProps, "disabled" | "shape" | "size">[];
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
  const anchor = useMemo(
    () => (
      <Button
        {...props.anchor}
        style={{ ...props.anchor.style, padding }}
        disabled={disabled}
        size={size}
        shape="round"
      />
    ),
    [disabled, padding, props.anchor, size]
  );
  const buttons = useMemo(
    () =>
      props.buttons?.map((props) => (
        <Button
          {...props}
          id={v4()}
          style={{ ...props.style }}
          disabled={disabled}
          size={size}
          shape="round"
        />
      )),
    [disabled, props.buttons, size]
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
        <Button.Group>
          {anchor}
          {buttons}
        </Button.Group>
      </div>
    </div>
  );
}
