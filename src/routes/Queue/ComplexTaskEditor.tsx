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
import { Dispatch, ReactNode, SetStateAction, useCallback, useMemo, useRef, useState } from "react";
import { v4 } from "uuid";
import { Preset, PresetType, usePresetStore } from "../../store/preset";
import { ParamsSource, Task, TaskInputParams, TaskOutputParams } from "../../store/task";

export type TaskEditorProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  task?: Task;
};

const ParamsEditor = ({
  presetOptions,
  record,
  onSave,
}: {
  presetOptions: ReactNode[];
  record: TaskInputParams | TaskOutputParams;
  onSave: (id: string, value: Partial<TaskInputParams | TaskOutputParams>) => void;
}) => {
  type ParamsEditorFormData = {
    selection: ParamsSource.Auto | ParamsSource.Custom | string;
    custom?: string;
  };

  const presets = usePresetStore((state) => state.presets);
  const formRef = useRef<FormInstance<ParamsEditorFormData>>(null);

  let initialValues: ParamsEditorFormData;
  switch (record.source) {
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
      const params = record.params as Preset;
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
  const [selection, setSelection] = useState<ParamsSource.Auto | ParamsSource.Custom | string>(
    initialValues.selection
  );
  const onChange = useCallback(
    (changed: Partial<ParamsEditorFormData>) => {
      // clear custom input field if selection change
      // hide custom input field and prevent validating `custom` field and if selection is not Custom
      let keys: (keyof ParamsEditorFormData)[];
      if (changed.selection) {
        setSelection(changed.selection);
        formRef.current?.clearFields(["custom"]); // clear custom input if selection changed
        keys = ["selection"]; // do not validate custom field
      } else {
        keys = ["selection", "custom"];
      }

      // validate form, save it if validation pass
      formRef.current?.validate(keys).then((value) => {
        let source: ParamsSource, params: Preset | string[] | undefined;
        if (value.selection === ParamsSource.Auto) {
          source = value.selection;
          params = undefined;
        } else if (value.selection === ParamsSource.Custom) {
          source = value.selection;
          params = [];
        } else {
          source = ParamsSource.FromPreset;
          params = cloneDeep({ ...presets.find((p) => p.id)! });
        }

        onSave(record.id, {
          source,
          params,
        });
      });
    },
    [presets, record, onSave]
  );

  return (
    <Form size="mini" ref={formRef} initialValues={initialValues} onChange={onChange}>
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
            {presetOptions}
          </Select>
        </Form.Item>

        {/* Custom Params Input */}
        {selection === ParamsSource.Custom ? (
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
  record,
  onRemove,
}: {
  record: TaskInputParams | TaskOutputParams;
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

const UniverseTable = ({
  pathTitle,
  sourceTitle,
  presetOptions,
  records,
  setRecords,
}: {
  pathTitle: string;
  sourceTitle: string;
  presetOptions: ReactNode[];
  records: (TaskInputParams | TaskOutputParams)[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setRecords: Dispatch<SetStateAction<any[]>>;
}) => {
  const onSave = useCallback(
    (id: string, value: Partial<TaskInputParams | TaskOutputParams>) => {
      setRecords((records: (TaskInputParams | TaskOutputParams)[]) =>
        records.map((record) => {
          if (record.id === id) {
            return {
              ...record,
              ...value,
            };
          } else {
            return record;
          }
        })
      );
    },
    [setRecords]
  );

  const onRemove = useCallback(
    (id: string) => setRecords((records) => records.filter((record) => record.id !== id)),
    [setRecords]
  );

  const columns: TableColumnProps<TaskInputParams | TaskOutputParams>[] = useMemo(
    () => [
      {
        title: pathTitle,
        dataIndex: "path",
        ellipsis: true,
      },
      {
        title: sourceTitle,
        dataIndex: "source",
        ellipsis: true,
        render: (_col, input) => (
          <ParamsEditor presetOptions={presetOptions} record={input} onSave={onSave} />
        ),
      },
      {
        title: "Operations",
        dataIndex: "remove",
        width: "6rem",
        align: "center",
        render: (_col, input) => <Operations record={input} onRemove={onRemove} />,
      },
    ],
    [pathTitle, sourceTitle, presetOptions, onSave, onRemove]
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

  return (
    <UniverseTable
      pathTitle="Input Files"
      sourceTitle="Decode Params"
      presetOptions={options}
      records={inputs}
      setRecords={setInputs}
    ></UniverseTable>
  );
};

const OutputTable = ({
  outputs,
  setOutputs,
}: {
  outputs: TaskOutputParams[];
  setOutputs: Dispatch<SetStateAction<TaskOutputParams[]>>;
}) => {
  const presets = usePresetStore((state) => state.presets);
  const options = useMemo(
    () =>
      presets
        .filter(
          (preset) => preset.type === PresetType.Universal || preset.type === PresetType.Encode
        )
        .map((preset) => (
          <Select.Option key={preset.id} value={preset.id}>
            {preset.name}
          </Select.Option>
        )),
    [presets]
  );

  return (
    <UniverseTable
      pathTitle="Output Files"
      sourceTitle="Encode Params"
      presetOptions={options}
      records={outputs}
      setRecords={setOutputs}
    ></UniverseTable>
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
  const [inputs, setInputs] = useState<TaskInputParams[]>(task?.params.inputs ?? []);
  const [outputs, setOutputs] = useState<TaskOutputParams[]>(task?.params.outputs ?? []);
  const submittable = useMemo(() => inputs.length !== 0 && outputs.length !== 0, [inputs, outputs]);
  const doubleConfirmCancellation = useMemo(
    () => inputs.length !== 0 || outputs.length !== 0,
    [inputs, outputs]
  );

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
        <OutputTable outputs={outputs} setOutputs={setOutputs} />
      </Space>
    </Modal>
  );
}
