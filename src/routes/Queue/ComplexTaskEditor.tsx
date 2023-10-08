import {
  Button,
  InputTag,
  Message,
  Modal,
  Space,
  Table,
  TableColumnProps,
} from "@arco-design/web-react";
import { IconDelete } from "@arco-design/web-react/icon";
import { open, save } from "@tauri-apps/api/dialog";
import { useState } from "react";
import { Task, TaskInputParams, TaskOutputParams, useTaskStore } from "../../store/task";

export type TaskEditorProps = {
  visible: boolean;
  onVisibleChanged: (visible: boolean) => void;
  task?: Task;
};

export default function ComplexTaskEditor({ visible, onVisibleChanged, task }: TaskEditorProps) {
  const addTask = useTaskStore((state) => state.addTask);

  const [inputs, setInputs] = useState<TaskInputParams[]>(task?.params.inputs ?? []);
  const [outputs, setOutputs] = useState<TaskOutputParams[]>(task?.params.outputs ?? []);

  const inputsTableCols: TableColumnProps[] = [
    {
      title: "Input Files",
      dataIndex: "path",
      ellipsis: true,
    },
    {
      title: "Decode Params",
      dataIndex: "params",
      ellipsis: true,
      render: (_col, item: TaskInputParams, index) => {
        const save = (params: string[]) => {
          inputs[index] = { ...inputs[index], params: [...params] };
          setInputs([...inputs]);
        };

        return (
          <InputTag
            allowClear
            saveOnBlur
            size="mini"
            value={item.params}
            onChange={save}
          ></InputTag>
        );
      },
    },
    {
      title: "Operations",
      dataIndex: "remove",
      width: "6rem",
      align: "center",
      render: (_col, _item, index) => {
        const remove = () => {
          inputs.splice(index, 1);
          setInputs([...inputs]);
        };

        return (
          <Button
            size="mini"
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={remove}
          ></Button>
        );
      },
    },
  ];

  const outputsTableCols: TableColumnProps[] = [
    {
      title: "Output Files",
      dataIndex: "path",
      ellipsis: true,
    },
    {
      title: "Encode Params",
      dataIndex: "params",
      ellipsis: true,
      render: (_col, item: TaskInputParams, index) => {
        const save = (params: string[]) => {
          outputs[index] = { ...outputs[index], params: [...params] };
          setOutputs([...outputs]);
        };

        return (
          <InputTag
            allowClear
            saveOnBlur
            size="mini"
            value={item.params}
            onChange={save}
          ></InputTag>
        );
      },
    },
    {
      title: "Operations",
      dataIndex: "remove",
      width: "6rem",
      align: "center",
      render: (_col, _item, index) => {
        const remove = () => {
          outputs.splice(index, 1);
          setOutputs([...outputs]);
        };

        return (
          <Button
            size="mini"
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={remove}
          ></Button>
        );
      },
    },
  ];

  /**
   * Add input files vis Tauri
   */
  const addInputFiles = async () => {
    const files = await open({
      title: "Add Input Files",
      directory: false,
      multiple: true,
    });

    if (files) {
      inputs.push(...(files as string[]).map((file) => ({ path: file })));
      setInputs([...inputs]);
    }
  };

  /**
   * Add output files vis Tauri
   */
  const addOutputFile = async () => {
    const file = await save({
      title: "Add Output File",
    });

    if (file) {
      outputs.push({
        path: file,
      });
      setOutputs([...outputs]);
    }
  };

  /**
   * Submits and adds a new task to store
   */
  const submit = () => {
    if (inputs.length === 0) {
      Message.warning("Empty Input Files");
      return;
    }
    if (outputs.length === 0) {
      Message.warning("Empty Output Files");
      return;
    }

    addTask({
      inputs,
      outputs,
    });
    onVisibleChanged(false);
  };

  return (
    <Modal
      simple
      maskClosable={false}
      style={{
        width: "60%",
        height: "80%",
        overflowY: "auto",
      }}
      visible={visible}
      onCancel={() => onVisibleChanged(false)}
      okText="Add Task"
      onOk={submit}
      afterClose={() => {
        setInputs([]);
        setOutputs([]);
      }}
    >
      {/* Buttons */}
      <Space className="mb-4">
        {/* Add Input Button */}
        <Button size="small" type="primary" onClick={addInputFiles}>
          Add Input Files
        </Button>

        {/* Add Output Button */}
        <Button size="small" type="primary" onClick={addOutputFile}>
          Add Output File
        </Button>
      </Space>

      {/* Input Files Table */}
      <Table
        stripe
        className="mb-4"
        size="mini"
        pagination={false}
        columns={inputsTableCols}
        data={inputs}
      ></Table>

      {/* Output Files Table */}
      <Table
        stripe
        size="mini"
        pagination={false}
        columns={outputsTableCols}
        data={outputs}
      ></Table>
    </Modal>
  );
}
