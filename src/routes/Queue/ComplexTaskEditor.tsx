import {
  Button,
  Form,
  FormInstance,
  Input,
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
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
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

type EditableTaskInputParams = {
  id: string;
  path: string;
  selection: ParamsSource.Auto | ParamsSource.Custom | string;
  custom?: string[];
};

type EditableTaskOutputParams = {
  id: string;
  path?: string;
  selection: ParamsSource.Auto | ParamsSource.Custom | string;
  custom?: string[];
};

const ParamsEditor = ({
  index,
  type,
  presetOptions,
  record,
}: {
  index: number;
  type: "inputs" | "outputs";
  presetOptions: ReactNode[];
  record: EditableTaskInputParams | EditableTaskOutputParams;
}) => {
  return (
    <Space size={2} style={{ width: "100%" }} direction="vertical">
      {/* Params Source Selector */}
      <Form.Item
        field={`${type}[${index}].selection`}
        style={{ marginBottom: 0 }}
        labelCol={{ span: 0 }}
        wrapperCol={{ span: 24 }}
        onChange={(v) => console.log(v)}
      >
        <Select size="mini">
          <Select.Option value={ParamsSource.Auto}>Auto</Select.Option>
          <Select.Option value={ParamsSource.Custom}>Custom</Select.Option>
          {presetOptions}
        </Select>
      </Form.Item>

      {/* Custom Params Input */}
      {record.selection === ParamsSource.Custom ? (
        <Form.Item
          field={`${type}[${index}].custom`}
          style={{ marginBottom: 0 }}
          labelCol={{ span: 0 }}
          wrapperCol={{ span: 24 }}
          rules={[{ required: true, message: "custom params is required" }]}
          formatter={(value: string | undefined) =>
            (value as unknown as string[] | undefined)?.join(" ")
          }
          normalize={(value: string | undefined) => value?.split(" ").map((param) => param.trim())}
        >
          <Input.TextArea autoFocus allowClear></Input.TextArea>
        </Form.Item>
      ) : null}
    </Space>
  );
};

const Operations = ({
  record,
  onRemove,
}: {
  record: EditableTaskInputParams | EditableTaskOutputParams;
  onRemove: (id: string) => void;
}) => {
  return (
    <Button
      size="mini"
      shape="circle"
      type="primary"
      status="danger"
      icon={<IconDelete />}
      onClick={() => onRemove(record.id)}
    ></Button>
  );
};

const UniverseTable = ({ type }: { type: "inputs" | "outputs" }) => {
  const { inputs, setInputs, outputs, setOutputs, getFormInstance } = useContext(Context)!;
  const records = useMemo(() => (type === "inputs" ? inputs : outputs), [type, inputs, outputs]);

  const presets = usePresetStore((state) => state.presets);
  const options = useMemo(
    () =>
      presets
        .filter((preset) => {
          if (type === "inputs") {
            return preset.type === PresetType.Universal || preset.type === PresetType.Decode;
          } else {
            return preset.type === PresetType.Universal || preset.type === PresetType.Encode;
          }
        })
        .map((preset) => (
          <Select.Option key={preset.id} value={preset.id}>
            {preset.name}
          </Select.Option>
        )),
    [type, presets]
  );

  const removeFromTable = useCallback(
    (id: string) => {
      if (type === "inputs") {
        setInputs((records) => records.filter((record) => record.id !== id));
      } else {
        setOutputs((records) => records.filter((record) => record.id !== id));
      }
    },
    [type, setInputs, setOutputs]
  );
  const removeFromForm = useCallback(
    (id: string) => {
      const formInstance = getFormInstance()!;
      const records = formInstance.getFieldValue(type);
      getFormInstance()!.setFieldValue(
        type,
        records.filter((record) => record.id !== id)
      );
    },
    [type, getFormInstance]
  );

  const onRemove = useCallback(
    (id: string) => {
      removeFromTable(id);
      removeFromForm(id);
    },
    [removeFromTable, removeFromForm]
  );

  const columns: TableColumnProps<EditableTaskInputParams | EditableTaskOutputParams>[] = useMemo(
    () => [
      {
        title: type === "inputs" ? "Input Files" : "Output Files",
        dataIndex: "path",
        ellipsis: true,
        render: (_col, record) => record.path ?? "NULL",
      },
      {
        title: type === "inputs" ? "Decode Params" : "Encode Params",
        dataIndex: "selection",
        ellipsis: true,
        render: (_col, record, index) => (
          <ParamsEditor index={index} presetOptions={options} type={type} record={record} />
        ),
      },
      {
        title: "Operations",
        dataIndex: "remove",
        width: "6rem",
        align: "center",
        render: (_col, record) => <Operations record={record} onRemove={onRemove} />,
      },
    ],
    [type, options, onRemove]
  );

  return (
    <Table
      stripe
      size="mini"
      rowKey="id"
      pagination={false}
      columns={columns}
      data={records}
    ></Table>
  );
};

const Footer = ({
  submittable,
  doubleConfirmCancellation,
  onCancel,
  onSubmit,
}: {
  submittable: boolean;
  doubleConfirmCancellation: boolean;
  onCancel: () => void;
  onSubmit: () => void;
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
      <Button type="primary" disabled={!submittable} onClick={onSubmit}>
        Add Task
      </Button>
    </>
  );
};

const Context = createContext<{
  inputs: EditableTaskInputParams[];
  setInputs: Dispatch<SetStateAction<EditableTaskInputParams[]>>;
  outputs: EditableTaskOutputParams[];
  setOutputs: Dispatch<SetStateAction<EditableTaskOutputParams[]>>;
  getFormInstance: () => FormInstance<{
    inputs: EditableTaskInputParams[];
    outputs: EditableTaskOutputParams[];
  }> | null;
} | null>(null);

const toTaskParams = (
  { selection, path, custom }: EditableTaskInputParams | EditableTaskOutputParams,
  presets: Preset[]
) => {
  let source: ParamsSource, params: string[] | Preset | undefined;
  if (selection === ParamsSource.Auto) {
    source = ParamsSource.Auto;
    params = undefined;
  } else if (selection === ParamsSource.Custom) {
    source = ParamsSource.Custom;
    params = custom;
  } else {
    source = ParamsSource.FromPreset;
    params = cloneDeep(presets.find((preset) => preset.id === selection)!);
  }

  return {
    path,
    source,
    params,
  } as TaskInputParams | TaskOutputParams;
};

const fromTaskParams = (
  { path, source, params }: TaskInputParams | TaskOutputParams,
  presets: Preset[]
): EditableTaskInputParams | EditableTaskOutputParams => {
  switch (source) {
    case ParamsSource.Auto:
      return {
        id: v4(),
        path,
        selection: ParamsSource.Auto,
      };
    case ParamsSource.Custom:
      return {
        id: v4(),
        path,
        selection: ParamsSource.Custom,
        custom: params as string[],
      };
    case ParamsSource.FromPreset: {
      const preset = presets.find((preset) => preset.id === (params as Preset).id);
      if (preset) {
        return {
          id: v4(),
          path,
          selection: preset.id,
        };
      } else {
        return {
          id: v4(),
          path,
          selection: ParamsSource.Custom,
          custom: [...(params as Preset).params],
        };
      }
    }
  }
};

export default function ComplexTaskEditor({ visible, onVisibleChange, task }: TaskEditorProps) {
  const addTask = useTaskStore((state) => state.addTask);
  const presets = usePresetStore((state) => state.presets);

  const [inputs, setInputs] = useState<EditableTaskInputParams[]>(
    task?.params.inputs.map((input) => fromTaskParams(input, presets) as EditableTaskInputParams) ??
      []
  );
  const [outputs, setOutputs] = useState<EditableTaskOutputParams[]>(
    task?.params.outputs.map(
      (output) => fromTaskParams(output, presets) as EditableTaskOutputParams
    ) ?? []
  );
  const formInstance = useRef<
    FormInstance<{
      inputs: EditableTaskInputParams[];
      outputs: EditableTaskOutputParams[];
    }>
  >(null);
  const formInitialValues = useMemo(
    () => ({
      inputs: cloneDeep(inputs),
      outputs: cloneDeep(outputs),
    }),
    [inputs, outputs]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFormChange = () => {
    const formValues = formInstance.current!.getFieldsValue();
    console.log(formValues);

    if (formValues.inputs) {
      const formInputs = formValues.inputs;
      setInputs((state) => state.map((input, index) => ({ ...input, ...formInputs[index] })));
    }
    if (formValues.outputs) {
      const formOutputs = formValues.outputs;
      setOutputs((state) => state.map((output, index) => ({ ...output, ...formOutputs[index] })));
    }
  };

  /**
   * Add input files vis Tauri
   */
  const addInputFiles = async () => {
    const files = (await open({
      title: "Add Input Files",
      filters: [],
      directory: false,
      multiple: true,
    })) as string[] | null;

    if (files && formInstance.current) {
      const inputs: EditableTaskInputParams[] = files.map((file) => ({
        id: v4(),
        path: file,
        selection: ParamsSource.Auto,
      }));
      formInstance.current.setFieldValue("inputs", [
        ...(formInstance.current.getFieldValue("inputs") ?? []),
        ...cloneDeep(inputs),
      ]);
      setInputs((state) => [...state, ...cloneDeep(inputs)]);
    }
  };

  /**
   * Add output files vis Tauri
   */
  const addOutputFile = async () => {
    const file = await save({
      title: "Add Output File",
    });

    if (file && formInstance.current) {
      const output: EditableTaskInputParams = {
        id: v4(),
        path: file,
        selection: ParamsSource.Auto,
      };
      formInstance.current.setFieldValue("outputs", [
        ...(formInstance.current.getFieldValue("outputs") ?? []),
        { ...output },
      ]);
      setOutputs((state) => [...state, { ...output }]);
    }
  };

  /**
   * Add NULL output
   */
  const addNullOutput = () => {
    const output: EditableTaskOutputParams = {
      id: v4(),
      selection: ParamsSource.Auto,
    };

    formInstance.current?.setFieldValue("outputs", [
      ...(formInstance.current.getFieldValue("outputs") ?? []),
      { ...output },
    ]);
    setOutputs((state) => [...state, { ...output }]);
  };

  const doubleConfirmCancellation = useMemo(
    () => inputs.length !== 0 || outputs.length !== 0,
    [inputs, outputs]
  );

  const submittable = useMemo(() => inputs.length !== 0 && outputs.length !== 0, [inputs, outputs]);
  /**
   * Verify form and add new task if successfully validated
   */
  const onSubmit = () => {
    if (!formInstance.current) return;

    formInstance.current.validate().then(() => {
      addTask({
        inputs: inputs.map((input) => toTaskParams(input, presets) as TaskInputParams),
        outputs: outputs.map((output) => toTaskParams(output, presets) as TaskOutputParams),
      });
      onVisibleChange(false);
    });
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
          submittable={submittable}
          doubleConfirmCancellation={doubleConfirmCancellation}
          onCancel={() => onVisibleChange(false)}
          onSubmit={onSubmit}
        />
      }
      afterClose={() => {
        setInputs([]);
        setOutputs([]);
        formInstance.current?.clearFields();
      }}
    >
      <Space direction="vertical">
        {/* Buttons */}
        <Space>
          {/* Add Input Files Button */}
          <Button size="small" type="primary" onClick={addInputFiles}>
            Add Input Files
          </Button>

          {/* Add Output File Button */}
          <Button size="small" type="primary" onClick={addOutputFile}>
            Add Output File
          </Button>

          {/* Add NULL Output Button */}
          <Button size="small" type="primary" status="warning" onClick={addNullOutput}>
            Add NULL Output
          </Button>
        </Space>

        <Context.Provider
          value={{
            inputs,
            setInputs,
            outputs,
            setOutputs,
            getFormInstance: () => formInstance.current,
          }}
        >
          <Form
            size="mini"
            ref={formInstance}
            initialValues={formInitialValues}
            onChange={onFormChange}
          >
            <Space direction="vertical">
              {/* Input Files Table */}
              <UniverseTable type="inputs"></UniverseTable>

              {/* Output Files Table */}
              <UniverseTable type="outputs"></UniverseTable>
            </Space>
          </Form>
        </Context.Provider>
      </Space>
    </Modal>
  );
}
