import {
  Button,
  Modal,
  Popconfirm,
  Space,
  Table,
  TableColumnProps,
  Tooltip,
} from "@arco-design/web-react";
import { IconCopy, IconDelete, IconFilter } from "@arco-design/web-react/icon";
import { open, save } from "@tauri-apps/api/dialog";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { v4 } from "uuid";
import { toTaskParams } from ".";
import { useAppStore } from "../../store/app";
import { Preset, PresetType, usePresetStore } from "../../store/preset";
import {
  ParamsSource,
  Task,
  TaskInputParams,
  TaskOutputParams,
  useTaskStore,
} from "../../store/task";
import { EditableTaskParams } from "./";
import ParamsModifier from "./ParamsModifier";

export type ComplexTaskModifierProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  task?: Task;
};

const Operations = ({
  record,
  onRemove,
  onApplyAll,
  onConvertCustom,
}: {
  record: EditableTaskParams;
  onRemove: (id: string) => void;
  onApplyAll: (record: EditableTaskParams) => void;
  onConvertCustom: (record: EditableTaskParams) => void;
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
  presetType,
  records,
  setRecords,
}: {
  filesTitle: string;
  paramsTitle: string;
  presetType: PresetType.Decode | PresetType.Encode;
  records: EditableTaskParams[];
  setRecords: Dispatch<SetStateAction<EditableTaskParams[]>>;
}) => {
  const presets = usePresetStore((state) => state.presets);

  const onChange = useCallback(
    (id: string, values: Partial<EditableTaskParams>) => {
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
    ({ id, selection, custom }: EditableTaskParams) => {
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
    ({ id, selection }: EditableTaskParams) => {
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

  const columns: TableColumnProps<EditableTaskParams>[] = useMemo(
    () => [
      {
        title: filesTitle,
        ellipsis: true,
        render: (_col, record) => record.path ?? "NULL",
      },
      {
        title: paramsTitle,
        ellipsis: true,
        render: (_col, record) => (
          <ParamsModifier presetType={presetType} record={record} onChange={onChange} />
        ),
      },
      {
        title: "Operations",
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
    [presetType, filesTitle, paramsTitle, onRemove, onChange, onApplyAll, onConvertCustom]
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
  inputs: EditableTaskParams[];
  setInputs: Dispatch<SetStateAction<EditableTaskParams[]>>;
}) => {
  return (
    <UniverseTable
      filesTitle="Input Files"
      paramsTitle="Decode Params"
      presetType={PresetType.Decode}
      records={inputs}
      setRecords={setInputs}
    ></UniverseTable>
  );
};

const OutputTable = ({
  outputs,
  setOutputs,
}: {
  outputs: EditableTaskParams[];
  setOutputs: Dispatch<SetStateAction<EditableTaskParams[]>>;
}) => {
  return (
    <UniverseTable
      filesTitle="Output Files"
      paramsTitle="Encode Params"
      presetType={PresetType.Encode}
      records={outputs}
      setRecords={setOutputs}
    ></UniverseTable>
  );
};

const Footer = ({
  task,
  modified,
  inputs,
  outputs,
  onVisibleChange,
}: {
  task?: Task;
  modified: boolean;
  inputs: EditableTaskParams[];
  outputs: EditableTaskParams[];
  onVisibleChange: (visible: boolean) => void;
}) => {
  const { addTasks, updateTask } = useTaskStore();
  const presets = usePresetStore((state) => state.presets);

  const onCancel = () => onVisibleChange(false);
  const onSubmit = () => {
    const params = {
      inputs: inputs.map((input) => toTaskParams(input, presets) as TaskInputParams),
      outputs: outputs.map((output) => toTaskParams(output, presets) as TaskOutputParams),
    };
    if (task) {
      updateTask(task.id, {
        metadata: [],
        workTimeDurations: [],
        params,
      });
    } else {
      addTasks(params);
    }
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

      {/* Add or Save Task Button */}
      <Button type="primary" disabled={!modified} onClick={onSubmit}>
        {task ? "Save" : "Add"}
      </Button>
    </>
  );
};

/**
 * Converts {@link TaskInputParams} or {@link TaskOutputParams}
 * to {@link EditableTaskParams} or {@link EditableTaskParams}
 * @param params {@link TaskInputParams} or {@link TaskOutputParams}
 * @param presets Presets
 * @returns a {@link EditableTaskParams} or {@link EditableTaskParams}
 */
const fromTaskParams = (
  { path, source, params }: TaskInputParams | TaskOutputParams,
  presets: Preset[]
): EditableTaskParams => {
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

export default function ComplexTaskModifier({
  visible,
  onVisibleChange,
  task,
}: ComplexTaskModifierProps) {
  const { configuration, openDialogFilters, saveDialogFilters } = useAppStore();
  const { presets, defaultDecode, defaultEncode } = usePresetStore();

  const [inputs, setInputs] = useState<EditableTaskParams[]>([]);
  const [outputs, setOutputs] = useState<EditableTaskParams[]>([]);
  const [modified, setModified] = useState(false);

  const wrappedSetInputs = useCallback(
    (s: SetStateAction<EditableTaskParams[]>) => {
      setInputs(s);
      setModified(true);
    },
    [setInputs, setModified]
  );
  const wrappedSetOutputs = useCallback(
    (s: SetStateAction<EditableTaskParams[]>) => {
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
        task.params.inputs.map((input) => fromTaskParams(input, presets) as EditableTaskParams)
      );
      setOutputs(
        task.params.outputs.map((output) => fromTaskParams(output, presets) as EditableTaskParams)
      );
      setModified(false);
    } else {
      setInputs([]);
      setOutputs([]);
      setModified(false);
    }
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
      const inputs: EditableTaskParams[] = files.map((file) => ({
        id: v4(),
        path: file,
        selection: defaultDecode ?? ParamsSource.Auto,
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
      const output: EditableTaskParams = {
        id: v4(),
        path: file,
        selection: defaultEncode ?? ParamsSource.Auto,
      };
      wrappedSetOutputs((state) => [...state, { ...output }]);
    }
  };

  /**
   * Add NULL output
   */
  const addNullOutput = () => {
    const output: EditableTaskParams = {
      id: v4(),
      selection: defaultEncode ?? ParamsSource.Auto,
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
          task={task}
          modified={modified}
          inputs={inputs}
          outputs={outputs}
          onVisibleChange={onVisibleChange}
        />
      }
      afterClose={() => {
        setInputs([]);
        setOutputs([]);
        setModified(false);
      }}
    >
      {/* Buttons */}
      <Space className="mb-4">
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
      <div className="mb-4">
        <InputTable inputs={inputs} setInputs={wrappedSetInputs}></InputTable>
      </div>

      {/* Output Files Table */}
      <OutputTable outputs={outputs} setOutputs={wrappedSetOutputs}></OutputTable>
    </Modal>
  );
}
