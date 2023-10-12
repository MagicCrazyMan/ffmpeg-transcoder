import {
  Button,
  Form,
  FormInstance,
  Input,
  Message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  TableColumnProps,
} from "@arco-design/web-react";
import { IconDelete } from "@arco-design/web-react/icon";
import { open, save } from "@tauri-apps/api/dialog";
import { cloneDeep } from "lodash";
import { Dispatch, ReactNode, SetStateAction, useCallback, useMemo, useRef, useState } from "react";
import { v4 } from "uuid";
import { Preset, PresetType, usePresetStore } from "../../store/preset";
import {
  ParamsSource,
  Task,
  TaskInputParams,
  TaskOutputParams,
  useTaskStore,
} from "../../store/task";

export type TaskEditorProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  task?: Task;
};

type ParamsEditorFormData = {
  selection: ParamsSource.Auto | ParamsSource.Custom | string;
  custom?: string;
};

const ParamsEditor = ({
  input,
  options, // onChange,
}: {
  input: TaskInputParams;
  options: ReactNode[];
  onChange: (
    id: string,
    value: Partial<ParamsEditorFormData>,
    values: Partial<ParamsEditorFormData>
  ) => void;
}) => {
  const presets = usePresetStore((state) => state.presets);
  const formRef = useRef<FormInstance<ParamsEditorFormData>>(null);

  let initialValues: ParamsEditorFormData;
  switch (input.source) {
    case ParamsSource.Auto:
      initialValues = {
        selection: ParamsSource.Auto,
      };
      break;
    case ParamsSource.Custom:
      initialValues = {
        selection: ParamsSource.Custom,
        custom: "",
      };
      break;
    case ParamsSource.FromPreset: {
      const params = input.params as Preset;
      const preset = presets.find(({ id }) => params.id === id);
      if (preset) {
        initialValues = {
          selection: preset.id,
        };
      } else {
        initialValues = {
          selection: ParamsSource.Custom,
          custom: "",
        };
      }
      break;
    }
  }
  const [formValues, setFormValues] = useState<ParamsEditorFormData>(initialValues);

  return (
    <Form
      size="mini"
      ref={formRef}
      initialValues={formValues}
      onChange={(data) => setFormValues((state) => ({ ...state, ...data }))}
    >
      <Space size={2} direction="vertical">
        {/* Params Source Selector */}
        <Form.Item
          field="selection"
          style={{ marginBottom: 0 }}
          labelCol={{ span: 0 }}
          wrapperCol={{ span: 24 }}
        >
          <Select size="mini">
            <Select.Option value={ParamsSource.Auto}>Auto</Select.Option>
            <Select.Option value={ParamsSource.Custom}>Custom</Select.Option>
            {options}
          </Select>
        </Form.Item>

        {/* Custom Params Source Input */}
        {formValues.selection === ParamsSource.Custom ? (
          <Form.Item
            field="custom"
            style={{ marginBottom: 0 }}
            labelCol={{ span: 0 }}
            wrapperCol={{ span: 24 }}
            rules={[{ required: true, message: "params is required" }]}
          >
            <Input allowClear></Input>
          </Form.Item>
        ) : null}
      </Space>
    </Form>
  );
};

const Operations = ({
  input,
  onRemove,
}: {
  input: TaskInputParams;
  onRemove: (id: string) => void;
}) => {
  return (
    <Button
      size="mini"
      shape="circle"
      type="primary"
      status="danger"
      icon={<IconDelete />}
      onClick={() => onRemove(input.id)}
    ></Button>
  );
};

const InputTable = ({
  inputs,
  setInputs,
}: {
  inputs: TaskInputParams[];
  setInputs: Dispatch<SetStateAction<TaskInputParams[]>>;
}) => {
  const presets = usePresetStore((state) => state.presets);
  const options = useMemo(
    () =>
      presets
        .filter(
          (preset) => preset.type === PresetType.Universal || preset.type === PresetType.Decode
        )
        .map((preset) => (
          <Select.Option key={preset.id} value={preset.id}>
            {preset.name}
          </Select.Option>
        )),
    [presets]
  );

  const save = useCallback(
    (id: string, value: Partial<ParamsEditorFormData>) => {
      let source: ParamsSource, params: Preset | string[] | undefined;
      if (value.selection === ParamsSource.Auto) {
        params = undefined;
      } else if (value.selection === ParamsSource.Custom) {
        source = value.selection;
        params = [];
      } else {
        source = ParamsSource.FromPreset;
        params = cloneDeep({ ...presets.find((p) => p.id)! });
      }

      setInputs((inputs) =>
        inputs.map((input) => {
          if (input.id === id) {
            return {
              ...input,
              source,
              params,
            };
          } else {
            return input;
          }
        })
      );
    },
    [presets, setInputs]
  );

  const remove = useCallback(
    (id: string) => setInputs((inputs) => inputs.filter((input) => input.id !== id)),
    [setInputs]
  );

  const tableCols: TableColumnProps<TaskInputParams>[] = [
    {
      title: "Input Files",
      dataIndex: "path",
      ellipsis: true,
    },
    {
      title: "Decode Params",
      dataIndex: "source",
      ellipsis: true,
      render: (_col, input) => <ParamsEditor options={options} input={input} onChange={save} />,
    },
    {
      title: "Operations",
      dataIndex: "remove",
      width: "6rem",
      align: "center",
      render: (_col, input) => <Operations input={input} onRemove={remove} />,
    },
  ];

  return (
    <Table
      stripe
      size="mini"
      rowKey="id"
      pagination={false}
      columns={tableCols}
      data={inputs}
    ></Table>
  );
};

const Footer = ({
  doubleConfirmCancellation,
  onCancel,
  submittable,
}: {
  doubleConfirmCancellation: boolean;
  onCancel: () => void;
  submittable: boolean;
}) => {
  return (
    <>
      {/* Cancel & Double Confirm */}
      {doubleConfirmCancellation ? (
        <Popconfirm
          focusLock
          title="unsaved task, sure to cancel?"
          disabled={!doubleConfirmCancellation}
          onOk={onCancel}
        >
          <Button status="danger">Cancel</Button>
        </Popconfirm>
      ) : (
        <Button status="danger" onClick={onCancel}>
          Cancel
        </Button>
      )}

      {/* Add Task Button */}
      <Button type="primary" disabled={!submittable}>
        Add Task
      </Button>
    </>
  );
};

export default function ComplexTaskEditor({ visible, onVisibleChange, task }: TaskEditorProps) {
  const addTask = useTaskStore((state) => state.addTask);
  const presets = usePresetStore((state) => state.presets);

  const [inputs, setInputs] = useState<TaskInputParams[]>(task?.params.inputs ?? []);
  const [outputs, setOutputs] = useState<TaskOutputParams[]>(task?.params.outputs ?? []);
  const submittable = useMemo(() => inputs.length !== 0 && outputs.length !== 0, [inputs, outputs]);
  const doubleConfirmCancellation = useMemo(
    () => inputs.length !== 0 || outputs.length !== 0,
    [inputs, outputs]
  );

  /**
   * Selectable params options
   */
  const { SelectableDecodeParamsOptions, SelectableEncodeParamsOptions } = useMemo(() => {
    const SelectableDecodeParamsOptions: ReactNode[] = [];
    const SelectableEncodeParamsOptions: ReactNode[] = [];

    presets.forEach((preset, index) => {
      const option = (
        <Select.Option key={preset.id} value={index}>
          {preset.name}
        </Select.Option>
      );
      switch (preset.type) {
        case PresetType.Universal:
          SelectableDecodeParamsOptions.push(option);
          SelectableEncodeParamsOptions.push(option);
          break;
        case PresetType.Decode:
          SelectableDecodeParamsOptions.push(option);
          break;
        case PresetType.Encode:
          SelectableEncodeParamsOptions.push(option);
          break;
      }
    });

    return { SelectableDecodeParamsOptions, SelectableEncodeParamsOptions };
  }, [presets]);

  /**
   * Removes output file from list
   * @param id List index
   */
  const removeOutput = (id: string) => {
    setInputs((inputs) => inputs.filter((input) => input.id !== id));
  };

  const outputsTableCols: TableColumnProps<TaskOutputParams>[] = [
    {
      title: "Output Files",
      dataIndex: "path",
      ellipsis: true,
    },
    {
      title: "Encode Params",
      dataIndex: "params",
      ellipsis: true,
      render: (_col, item, index) => {
        const save = (params: string[]) => {
          setOutputs((outputs) =>
            outputs.map((output, i) => (i === index ? { ...output, params } : output))
          );
        };

        return (
          <Select allowClear size="mini" value={item.params} onChange={save}>
            <Select.Option value={-1}>Custom</Select.Option>
            {SelectableEncodeParamsOptions}
          </Select>
        );
      },
    },
    {
      title: "Operations",
      dataIndex: "remove",
      width: "6rem",
      align: "center",
      render: (_col, record) => {
        return (
          <Button
            size="mini"
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={() => removeOutput(record.id)}
          ></Button>
        );
      },
    },
  ];

  /**
   * Add input files vis Tauri
   */
  const addInputFiles = async () => {
    const files = (await open({
      title: "Add Input Files",
      directory: false,
      multiple: true,
    })) as string[] | null;

    if (files) {
      setInputs((inputs) => [
        ...inputs,
        ...files.map((file) => ({
          id: v4(),
          path: file,
          source: ParamsSource.Auto,
        })),
      ]);
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
      setOutputs((outputs) => [
        ...outputs,
        {
          id: v4(),
          path: file,
          source: ParamsSource.Auto,
        },
      ]);
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
    onVisibleChange(false);
  };

  return (
    <Modal
      simple
      maskClosable={false}
      style={{
        width: "60%",
        maxHeight: "80%",
        overflowY: "auto",
      }}
      visible={visible}
      footer={
        <Footer
          doubleConfirmCancellation={doubleConfirmCancellation}
          onCancel={() => onVisibleChange(false)}
          submittable={submittable}
        />
      }
      afterClose={() => {
        setInputs([]);
        setOutputs([]);
      }}
    >
      <Space direction="vertical">
        {/* Buttons */}
        <Space>
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
        <InputTable inputs={inputs} setInputs={setInputs} />

        {/* Output Files Table */}
        <Table
          stripe
          size="mini"
          rowKey="id"
          pagination={false}
          columns={outputsTableCols}
          data={outputs}
        ></Table>
      </Space>
    </Modal>
  );
}
