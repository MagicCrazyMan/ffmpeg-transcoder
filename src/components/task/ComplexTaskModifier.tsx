import { Button, Modal, Popconfirm, Space, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDelete } from "@arco-design/web-react/icon";
import { open, save } from "@tauri-apps/api/dialog";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { v4 } from "uuid";
import { Preset, PresetType } from "../../libs/preset";
import { Task, TaskArgsSource } from "../../libs/task";
import {
  ModifyingTaskArgsItem,
  fromTaskArgs,
  replaceExtension,
  toTaskArgs,
} from "../../libs/task/modifying";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";
import { useTaskStore } from "../../store/task";
import CodecModifier from "./CodecModifier";
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
  records: ModifyingTaskArgsItem[];
  setRecords: Dispatch<SetStateAction<ModifyingTaskArgsItem[]>>;
}) => {
  const filesTitle = useMemo(() => (type === "input" ? "Input Files" : "Output Files"), [type]);
  const argsTitle = useMemo(
    () => (type === "input" ? "Decode Arguments" : "Encode Arguments"),
    [type]
  );
  const presetType = useMemo(
    () => (type === "input" ? PresetType.Decode : PresetType.Encode),
    [type]
  );

  const onSelectChange = useCallback(
    (
      { id }: ModifyingTaskArgsItem,
      selection: TaskArgsSource.Auto | TaskArgsSource.Custom | Preset
    ) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            if (selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom) {
              return {
                ...record,
                selection,
              };
            } else {
              // tries replacing extension if preset selected
              return {
                ...record,
                selection,
                path: record.path ? replaceExtension(record.path, selection) : record.path,
              };
            }
          } else {
            return record;
          }
        })
      );
    },
    [setRecords]
  );

  const onCustomChange = useCallback(
    ({ id }: ModifyingTaskArgsItem, custom: string) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            return {
              ...record,
              custom,
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
    ({ id, selection, custom }: ModifyingTaskArgsItem) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            return record;
          } else {
            if (selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom) {
              return { ...record, selection, custom };
            } else {
              return {
                ...record,
                selection,
                custom,
                path: record.path ? replaceExtension(record.path, selection) : record.path,
              };
            }
          }
        })
      );
    },
    [setRecords]
  );

  const onConvertCustom = useCallback(
    ({ id, selection, custom }: ModifyingTaskArgsItem) => {
      setRecords((state) =>
        state.map((record) => {
          if (record.id === id) {
            return {
              ...record,
              selection: TaskArgsSource.Custom,
              custom:
                selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom
                  ? custom
                  : selection.args.join(" "),
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
    (id: string) => {
      setRecords((state) => state.filter((record) => record.id !== id));
    },
    [setRecords]
  );

  const onOutputFileChange = useCallback(
    (id: string, path?: string) => {
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

  const columns: TableColumnProps<ModifyingTaskArgsItem>[] = useMemo(
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
                args={record}
                onChange={(path) => onOutputFileChange(record.id, path)}
              />
            );
          }
        },
      },
      {
        title: argsTitle,
        ellipsis: true,
        render: (_col, record) => (
          <CodecModifier
            presetType={presetType}
            record={record}
            onSelectChange={onSelectChange}
            onCustomChange={onCustomChange}
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
      argsTitle,
      type,
      onOutputFileChange,
      presetType,
      onSelectChange,
      onCustomChange,
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
  inputs: ModifyingTaskArgsItem[];
  outputs: ModifyingTaskArgsItem[];
  onVisibleChange: (visible: boolean) => void;
}) => {
  const { addTasks, updateTask } = useTaskStore();

  const onCancel = () => onVisibleChange(false);
  const onSubmit = () => {
    const args = {
      inputs: inputs.map((input) => toTaskArgs(input)),
      outputs: outputs.map((output) => toTaskArgs(output)),
    };
    if (task) {
      updateTask(task.id, {
        data: {
          ...task.data,
          args,
          metadata: [],
          durations: [],
        },
      });
    } else {
      addTasks(args);
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
  task,
  visible,
  onVisibleChange,
}: ComplexTaskModifierProps) {
  const { configuration, openDialogFilters, saveDialogFilters } = useAppStore();
  const { defaultDecode, defaultEncode } = usePresetStore();

  const [inputs, setInputs] = useState<ModifyingTaskArgsItem[]>([]);
  const [outputs, setOutputs] = useState<ModifyingTaskArgsItem[]>([]);
  const [modified, setModified] = useState(false);

  /**
   * Sets as modified when inputs or outputs change
   */
  useEffect(() => {
    setModified(true);
  }, [inputs, outputs]);

  /**
   * Updates inputs, outputs and modified state when task change
   */
  useEffect(() => {
    if (task) {
      setInputs(task.data.args.inputs.map((input) => fromTaskArgs(input)));
      setOutputs(task.data.args.outputs.map((output) => fromTaskArgs(output)));
      setModified(false);
    } else {
      setInputs([]);
      setOutputs([]);
      setModified(false);
    }
  }, [task]);

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
      const inputs: ModifyingTaskArgsItem[] = files.map((file) => ({
        id: v4(),
        path: file,
        selection: defaultDecode ?? TaskArgsSource.Auto,
      }));
      setInputs((state) => [...state, ...inputs]);
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
      const output: ModifyingTaskArgsItem = {
        id: v4(),
        path: file,
        selection: defaultEncode ?? TaskArgsSource.Auto,
      };
      setOutputs((state) => [...state, { ...output }]);
    }
  };

  /**
   * Add NULL output
   */
  const addNullOutput = () => {
    const output: ModifyingTaskArgsItem = {
      id: v4(),
      selection: defaultEncode ?? TaskArgsSource.Auto,
    };

    setOutputs((state) => [...state, { ...output }]);
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
        <UniverseTable type="input" records={inputs} setRecords={setInputs}></UniverseTable>
      </div>

      {/* Output Files Table */}
      <UniverseTable type="output" records={outputs} setRecords={setOutputs}></UniverseTable>
    </Modal>
  );
}
