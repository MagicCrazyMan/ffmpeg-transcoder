import { Divider } from "@arco-design/web-react";

type OutputCodecsProps = {
  className?: string
}

export default function OutputCodecs({ className }: OutputCodecsProps) {
  return (
    <div className={className}>
      <Divider style={{ margin: "0 0 0.5rem 0" }} orientation="left">
        Output Codecs
      </Divider>
    </div>
  );
}
