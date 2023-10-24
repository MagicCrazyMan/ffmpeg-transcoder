import { Button, Modal, Popconfirm, Space, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDelete } from "@arco-design/web-react/icon";
import { open, save } from "@tauri-apps/api/dialog";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { v4 } from "uuid";
import { TaskParamsModifyingValue } from ".";
import { PresetType } from "../../libs/preset";
import { Task, TaskInputParams, TaskOutputParams, TaskParamsSource } from "../../libs/task";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";
import { useTaskStore } from "../../store/task";
import { fromTaskParams, toTaskParams } from "../../utils";
import CodecModifier, { TaskParamsCodecValue } from "./CodecModifier";
import OutputFileModifier from "./OutputFileModifier";

export type ComplexTaskModifierProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  task?: Task;
};

const UniverseTable = ({
  type,
  records,
  setRecords,
}: {
  type: "input" | "output";
  records: TaskParamsModifyingValue[];
  setRecords: Dispatch<SetStateAction<TaskParamsModifyingValue[]>>;
}) => {
  const presets = usePresetStore((state) => state.storage.presets);

  const filesTitle = useMemo(() => (type === "input" ? "Input Files" : "Output Files"), [type]);
  const paramsTitle = useMemo(() => (type === "input" ? "Decode Params" : "Encode Params"), [type]);
  const presetType = useMemo(
    () => (type === "input" ? PresetType.Decode : PresetType.Encode),
    [type]
  );

  const onChange = useCallback(
    (id: string, values: Partial<TaskParamsCodecValue>) => {
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
    ({ id, selection, custom }: TaskParamsCodecValue) => {
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
    ({ id, selection }: TaskParamsCodecValue) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            return {
              ...record,
              selection: TaskParamsSource.Custom,
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

  const onOutputFileChange = useCallback(
    (id: string, path: string) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            return {
              ...record,
              path,
            };
          } else {
            return record;
          }
        })
      );
    },
    [setRecords]
  );

  const columns: TableColumnProps<TaskParamsModifyingValue>[] = useMemo(
    () => [
      {
        title: filesTitle,
        ellipsis: true,
        render: (_col, record) => {
          if (type === "input") {
            return record.path ?? "NULL";
          } else {
            return (
              <OutputFileModifier
                params={record}
                onChange={(path) => onOutputFileChange(record.id, path)}
              />
            );
          }
        },
      },
      {
        title: paramsTitle,
        ellipsis: true,
        render: (_col, record) => (
          <CodecModifier
            presetType={presetType}
            record={record}
            onChange={onChange}
            onApplyAll={onApplyAll}
            onConvertCustom={onConvertCustom}
          />
        ),
      },
      {
        title: "Operations",
        width: "6rem",
        align: "center",
        render: (_col, record) => (
          <Button
            size="mini"
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={() => onRemove(record.id)}
          />
        ),
      },
    ],
    [
      filesTitle,
      paramsTitle,
      type,
      onOutputFileChange,
      presetType,
      onChange,
      onApplyAll,
      onConvertCustom,
      onRemove,
    ]
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
  task,
  modified,
  inputs,
  outputs,
  onVisibleChange,
}: {
  task?: Task;
  modified: boolean;
  inputs: TaskParamsModifyingValue[];
  outputs: TaskParamsModifyingValue[];
  onVisibleChange: (visible: boolean) => void;
}) => {
  const { addTasks, updateTask } = useTaskStore();
  const presets = usePresetStore((state) => state.storage.presets);

  const onCancel = () => onVisibleChange(false);
  const onSubmit = () => {
    const params = {
      inputs: inputs.map((input) => toTaskParams(input, presets) as TaskInputParams),
      outputs: outputs.map((output) => toTaskParams(output, presets) as TaskOutputParams),
    };
    if (task) {
      updateTask(task.id, {
        data: {
          ...task.data,
          params,
          metadata: [],
          durations: [],
        },
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

export default function ComplexTaskModifier({
  visible,
  onVisibleChange,
  task,
}: ComplexTaskModifierProps) {
  const { configuration, openDialogFilters, saveDialogFilters } = useAppStore();
  const { storage } = usePresetStore();

  const [inputs, setInputs] = useState<TaskParamsModifyingValue[]>([]);
  const [outputs, setOutputs] = useState<TaskParamsModifyingValue[]>([]);
  const [modified, setModified] = useState(false);

  const wrappedSetInputs = useCallback(
    (s: SetStateAction<TaskParamsModifyingValue[]>) => {
      setInputs(s);
      setModified(true);
    },
    [setInputs, setModified]
  );
  const wrappedSetOutputs = useCallback(
    (s: SetStateAction<TaskParamsModifyingValue[]>) => {
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
        task.data.params.inputs.map(
          (input) => fromTaskParams(input, storage.presets) as TaskParamsModifyingValue
        )
      );
      setOutputs(
        task.data.params.outputs.map(
          (output) => fromTaskParams(output, storage.presets) as TaskParamsModifyingValue
        )
      );
      setModified(false);
    } else {
      setInputs([]);
      setOutputs([]);
      setModified(false);
    }
  }, [task, storage.presets]);

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
      const inputs: TaskParamsModifyingValue[] = files.map((file) => ({
        id: v4(),
        path: file,
        selection: storage.defaultDecode ?? TaskParamsSource.Auto,
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
      const output: TaskParamsModifyingValue = {
        id: v4(),
        path: file,
        selection: storage.defaultEncode ?? TaskParamsSource.Auto,
      };
      wrappedSetOutputs((state) => [...state, { ...output }]);
    }
  };

  /**
   * Add NULL output
   */
  const addNullOutput = () => {
    const output: TaskParamsModifyingValue = {
      id: v4(),
      selection: storage.defaultEncode ?? TaskParamsSource.Auto,
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
        <UniverseTable type="input" records={inputs} setRecords={wrappedSetInputs}></UniverseTable>
      </div>

      {/* Output Files Table */}
      <UniverseTable type="output" records={outputs} setRecords={wrappedSetOutputs}></UniverseTable>
    </Modal>
  );
}
