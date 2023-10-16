import {
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  TableColumnProps,
  Tooltip,
} from "@arco-design/web-react";
import { IconCopy, IconDelete, IconFilter } from "@arco-design/web-react/icon";
import { open, save } from "@tauri-apps/api/dialog";
import { cloneDeep } from "lodash";
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { v4 } from "uuid";
import { useAppStore } from "../../store/app";
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
  custom?: string;
};

type EditableTaskOutputParams = {
  id: string;
  path?: string;
  selection: ParamsSource.Auto | ParamsSource.Custom | string;
  custom?: string;
};

const ParamsEditor = ({
  presetOptions,
  record,
  onChange,
}: {
  presetOptions: ReactNode[];
  record: EditableTaskInputParams | EditableTaskOutputParams;
  onChange: (
    id: string,
    values: Partial<EditableTaskInputParams | EditableTaskOutputParams>
  ) => void;
}) => {
  return (
    <div className="flex flex-col gap-0.5">
      {/* Params Source Selector */}
      <Select
        autoWidth
        className="flex-1"
        size="mini"
        value={record.selection}
        onChange={(value) => onChange(record.id, { selection: value })}
      >
        <Select.Option value={ParamsSource.Auto}>Auto</Select.Option>
        <Select.Option value={ParamsSource.Custom}>Custom</Select.Option>
        {presetOptions}
      </Select>

      {/* Custom Params Input */}
      {record.selection === ParamsSource.Custom ? (
        <Input.TextArea
          autoFocus
          allowClear
          value={record.custom}
          onChange={(value) => onChange(record.id, { custom: value })}
        ></Input.TextArea>
      ) : null}
    </div>
  );
};

const Operations = ({
  record,
  onRemove,
  onApplyAll,
  onConvertCustom,
}: {
  record: EditableTaskInputParams | EditableTaskOutputParams;
  onRemove: (id: string) => void;
  onApplyAll: (record: EditableTaskInputParams | EditableTaskOutputParams) => void;
  onConvertCustom: (record: EditableTaskInputParams | EditableTaskOutputParams) => void;
}) => {
  return (
    <Space>
      {/* Apply Params to All Records Button */}
      <Tooltip content="Apply To All">
        <Button
          className="flex-shrink-0"
          shape="circle"
          size="mini"
          type="primary"
          icon={<IconCopy />}
          onClick={() => onApplyAll(record)}
        ></Button>
      </Tooltip>

      {/* Convert To Custom Button */}
      {record.selection !== ParamsSource.Auto && record.selection !== ParamsSource.Custom ? (
        <Tooltip content="Convert To Custom">
          <Button
            className="flex-shrink-0"
            shape="circle"
            size="mini"
            status="warning"
            type="primary"
            icon={<IconFilter />}
            onClick={() => onConvertCustom(record)}
          ></Button>
        </Tooltip>
      ) : null}

      {/* Delete Button */}
      <Button
        size="mini"
        shape="circle"
        type="primary"
        status="danger"
        icon={<IconDelete />}
        onClick={() => onRemove(record.id)}
      ></Button>
    </Space>
  );
};

const UniverseTable = ({
  filesTitle,
  paramsTitle,
  presetOptions,
  records,
  setRecords,
}: {
  filesTitle: string;
  paramsTitle: string;
  presetOptions: ReactNode[];
  records: (EditableTaskInputParams | EditableTaskOutputParams)[];
  setRecords: Dispatch<SetStateAction<(EditableTaskInputParams | EditableTaskOutputParams)[]>>;
}) => {
  const presets = usePresetStore((state) => state.presets);

  const onChange = useCallback(
    (id: string, values: Partial<EditableTaskInputParams | EditableTaskOutputParams>) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            return {
              ...record,
              ...values,
            };
          } else {
            return record;
          }
        })
      );
    },
    [setRecords]
  );

  const onApplyAll = useCallback(
    ({ id, selection, custom }: EditableTaskInputParams | EditableTaskOutputParams) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            return record;
          } else {
            return { ...record, selection, custom };
          }
        })
      );
    },
    [setRecords]
  );

  const onConvertCustom = useCallback(
    ({ id, selection }: EditableTaskInputParams | EditableTaskOutputParams) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            return {
              ...record,
              selection: ParamsSource.Custom,
              custom: presets.find((preset) => preset.id === selection)?.params.join(" "),
            };
          } else {
            return record;
          }
        })
      );
    },
    [presets, setRecords]
  );

  const onRemove = useCallback(
    (id: string) => {
      setRecords((state) => state.filter((record) => record.id !== id));
    },
    [setRecords]
  );

  const columns: TableColumnProps<EditableTaskInputParams | EditableTaskOutputParams>[] = useMemo(
    () => [
      {
        title: filesTitle,
        dataIndex: "path",
        ellipsis: true,
        render: (_col, record) => record.path ?? "NULL",
      },
      {
        title: paramsTitle,
        dataIndex: "selection",
        ellipsis: true,
        render: (_col, record) => (
          <ParamsEditor presetOptions={presetOptions} record={record} onChange={onChange} />
        ),
      },
      {
        title: "Operations",
        dataIndex: "remove",
        width: "7rem",
        render: (_col, record) => (
          <Operations
            record={record}
            onRemove={onRemove}
            onApplyAll={onApplyAll}
            onConvertCustom={onConvertCustom}
          />
        ),
      },
    ],
    [presetOptions, filesTitle, paramsTitle, onRemove, onChange, onApplyAll, onConvertCustom]
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
  inputs: EditableTaskInputParams[];
  setInputs: Dispatch<SetStateAction<EditableTaskInputParams[]>>;
}) => {
  const presets = usePresetStore((state) => state.presets);
  const presetOptions = useMemo(
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
      filesTitle="Input Files"
      paramsTitle="Decode Params"
      presetOptions={presetOptions}
      records={inputs}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRecords={setInputs as any}
    ></UniverseTable>
  );
};

const OutputTable = ({
  outputs,
  setOutputs,
}: {
  outputs: EditableTaskOutputParams[];
  setOutputs: Dispatch<SetStateAction<EditableTaskOutputParams[]>>;
}) => {
  const presets = usePresetStore((state) => state.presets);
  const presetOptions = useMemo(
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
      filesTitle="Output Files"
      paramsTitle="Encode Params"
      presetOptions={presetOptions}
      records={outputs}
      setRecords={setOutputs}
    ></UniverseTable>
  );
};

const Footer = ({
  modified,
  inputs,
  outputs,
  onVisibleChange,
}: {
  modified: boolean;
  inputs: EditableTaskInputParams[];
  outputs: EditableTaskOutputParams[];
  onVisibleChange: (visible: boolean) => void;
}) => {
  const addTask = useTaskStore((state) => state.addTask);
  const presets = usePresetStore((state) => state.presets);

  const submittable = useMemo(() => inputs.length !== 0 && outputs.length !== 0, [inputs, outputs]);

  const onCancel = () => onVisibleChange(false);

  const onSubmit = () => {
    addTask({
      inputs: inputs.map((input) => toTaskParams(input, presets) as TaskInputParams),
      outputs: outputs.map((output) => toTaskParams(output, presets) as TaskOutputParams),
    });
    onVisibleChange(false);
  };

  return (
    <>
      {/* Cancel & Double Confirm */}
      {modified ? (
        <Popconfirm focusLock title="unsaved task, sure to cancel?" onOk={onCancel}>
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

/**
 * Converts {@link EditableTaskInputParams} or {@link EditableTaskOutputParams}
 * to {@link TaskInputParams} or {@link TaskOutputParams}
 * @param params {@link EditableTaskInputParams} or {@link EditableTaskOutputParams}
 * @param presets Presets
 * @returns a {@link TaskInputParams} or {@link TaskOutputParams}
 */
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
    params = custom?.split(" ").filter((param) => !!param.trim());
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

/**
 * Converts {@link TaskInputParams} or {@link TaskOutputParams}
 * to {@link EditableTaskInputParams} or {@link EditableTaskOutputParams}
 * @param params {@link TaskInputParams} or {@link TaskOutputParams}
 * @param presets Presets
 * @returns a {@link EditableTaskInputParams} or {@link EditableTaskOutputParams}
 */
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
        custom: (params as string[]).join(" "),
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
          custom: (params as Preset).params.join(" "),
        };
      }
    }
  }
};

export default function ComplexTaskModifier({ visible, onVisibleChange, task }: TaskEditorProps) {
  const { configuration, openDialogFilters, saveDialogFilters } = useAppStore((state) => state);
  const presets = usePresetStore((state) => state.presets);

  const [inputs, setInputs] = useState<EditableTaskInputParams[]>([]);
  const [outputs, setOutputs] = useState<EditableTaskOutputParams[]>([]);
  const [modified, setModified] = useState(false);

  const wrappedSetInputs = useCallback(
    (s: SetStateAction<EditableTaskInputParams[]>) => {
      setInputs(s);
      setModified(true);
    },
    [setInputs, setModified]
  );
  const wrappedSetOutputs = useCallback(
    (s: SetStateAction<EditableTaskOutputParams[]>) => {
      setOutputs(s);
      setModified(true);
    },
    [setOutputs, setModified]
  );

  /**
   * Updates inputs, outputs and modified state when task change
   */
  useEffect(() => {
    if (task) {
      setInputs(
        task.params.inputs.map((input) => fromTaskParams(input, presets) as EditableTaskInputParams)
      );
      setOutputs(
        task.params.outputs.map(
          (output) => fromTaskParams(output, presets) as EditableTaskOutputParams
        )
      );
      setModified(false);
    } else {
      setInputs([]);
      setOutputs([]);
      setModified(false);
    }

    return () => {
      setInputs([]);
      setOutputs([]);
      setModified(false);
    };
  }, [task, presets]);

  /**
   * Reset to unmodified if inputs and outputs both fallback to empty when adding new task
   */
  useEffect(() => {
    if (!task && inputs.length + outputs.length === 0) {
      setModified(false);
    }
  }, [task, inputs, outputs, setModified]);

  /**
   * Add input files vis Tauri
   */
  const addInputFiles = async () => {
    const files = (await open({
      title: "Add Input Files",
      filters: openDialogFilters,
      directory: false,
      multiple: true,
    })) as string[] | null;

    if (files) {
      const inputs: EditableTaskInputParams[] = files.map((file) => ({
        id: v4(),
        path: file,
        selection: ParamsSource.Auto,
      }));
      wrappedSetInputs((state) => [...state, ...inputs]);
    }
  };

  /**
   * Add output files vis Tauri
   */
  const addOutputFile = async () => {
    const file = await save({
      title: "Add Output File",
      defaultPath: configuration.saveDirectory,
      filters: saveDialogFilters,
    });

    if (file) {
      const output: EditableTaskInputParams = {
        id: v4(),
        path: file,
        selection: ParamsSource.Auto,
      };
      wrappedSetOutputs((state) => [...state, { ...output }]);
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

    wrappedSetOutputs((state) => [...state, { ...output }]);
  };

  return (
    <Modal
      simple
      maskClosable={false}
      getChildrenPopupContainer={() => document.body}
      style={{
        width: "60%",
        maxHeight: "80%",
        overflowY: "auto",
      }}
      visible={visible}
      footer={
        <Footer
          modified={modified}
          inputs={inputs}
          outputs={outputs}
          onVisibleChange={onVisibleChange}
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

        {/* Input Files Table */}
        <InputTable inputs={inputs} setInputs={wrappedSetInputs}></InputTable>

        {/* Output Files Table */}
        <OutputTable outputs={outputs} setOutputs={wrappedSetOutputs}></OutputTable>
      </Space>
    </Modal>
  );
}
