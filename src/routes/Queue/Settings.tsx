import { Collapse, Form, Typography } from "@arco-design/web-react";
import { Task, TaskInputParams } from "../../store/task";
import { useMemo } from "react";

const Inputs = ({ params }: { params: TaskInputParams }) => {
  return (
    <Collapse>
      <Typography.Paragraph>{params.path}</Typography.Paragraph>
      <Form></Form>
    </Collapse>
  );
};

export default function Settings({ task }: { task: Task }) {
  const inputs = useMemo(
    () => task.params.inputs.map((input, index) => <Inputs key={index} params={input} />),
    [task]
  );

  return (
    <Collapse bordered={false}>
      <Collapse.Item name="Inputs">{inputs}</Collapse.Item>
      <Collapse.Item name="Outputs"></Collapse.Item>
    </Collapse>
  );
}
