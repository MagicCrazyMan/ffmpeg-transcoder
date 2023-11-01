import { Button, Modal, Popconfirm, Space, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDelete } from "@arco-design/web-react/icon";
import { join, sep } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { v4 } from "uuid";
import { Preset, PresetType } from "../../libs/preset";
import { TaskArgs, TaskArgsSource } from "../../libs/task";
import { ModifyingTaskArgsItem, replaceExtension, toTaskArgs } from "../../libs/task/modifying";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";
import { useTaskStore } from "../../store/task";
import CodecModifier from "./CodecModifier";
import OutputFileModifier from "./OutputFileModifier";

export type SimpleTasksModifierProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

export type SimpleTasksModifierInstance = {
  /**
   * Adds tasks from input files
   * @param inputFiles Input files
   */
  addTasksFromInputFiles: (...inputFiles: string[]) => Promise<void>;
};

type SimpleTaskArgs = {
  id: string;
  input: ModifyingTaskArgsItem;
  output: ModifyingTaskArgsItem;
};

const Footer = ({
  modified,
  records,
  onVisibleChange,
}: {
  modified: boolean;
  records: SimpleTaskArgs[];
  onVisibleChange: (visible: boolean) => void;
}) => {
  const { addTasks } = useTaskStore();

  const onCancel = () => onVisibleChange(false);
  const onSubmit = () => {
    addTasks(
      ...records.map(
        (record) =>
          ({
            inputs: [toTaskArgs(record.input)],
            outputs: [toTaskArgs(record.output)],
          }) as TaskArgs
      )
    );
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

      {/* Add Tasks Button */}
      <Button type="primary" disabled={!modified} onClick={onSubmit}>
        Add
      </Button>
    </>
  );
};

/**
 * Adds simple tasks args from input files
 * @param inputFiles Input files
 * @param saveDirectory Default save directory
 * @param defaultDecode Default decode preset
 * @param defaultEncode Default encode preset
 * @returns A list of simple tasks args.
 */
const toSimpleTaskArgs = async (
  inputFiles: string[],
  saveDirectory?: string,
  defaultDecode?: Preset,
  defaultEncode?: Preset
) => {
  const filePairs = await Promise.all<[string, string | undefined]>(
    inputFiles.map(async (file) => {
      if (saveDirectory) {
        const filename = file.split(sep()).pop();
        if (filename) {
          const outputFile = await join(saveDirectory, filename);
          return [file, outputFile] as [string, string];
        }
      }

      return [file, undefined] as [string, undefined];
    })
  );
  return filePairs.map(([input, output]) => {
    return {
      id: v4(),
      input: {
        id: v4(),
        path: input,
        selection: defaultDecode ?? TaskArgsSource.Auto,
      },
      output: {
        id: v4(),
        path: output,
        selection: defaultEncode ?? TaskArgsSource.Auto,
      },
    } as SimpleTaskArgs;
  });
};

const SimpleTasksModifier = forwardRef(
  ({ visible, onVisibleChange }: SimpleTasksModifierProps, ref) => {
    const { configuration, openDialogFilters } = useAppStore();
    const { defaultDecode, defaultEncode } = usePresetStore();

    const [records, setRecords] = useState<SimpleTaskArgs[]>([]);

    const modified = useMemo(() => records.length !== 0, [records]);

    /**
     * Add input files vis Tauri
     */
    const addInputFiles = async () => {
      const inputFiles = (await open({
        title: "Select Input Files",
        filters: openDialogFilters,
        directory: false,
        multiple: true,
      })) as string[] | null;

      if (!inputFiles) return;

      const records = await toSimpleTaskArgs(
        inputFiles,
        configuration.saveDirectory,
        defaultDecode,
        defaultEncode
      );
      setRecords((state) => [...state, ...records]);
    };

    /**
     * On select output files vis Tauri
     */
    const onOutputFileChange = useCallback(
      (id: string, path?: string) => {
        setRecords((state) =>
          state.map((task) => {
            if (task.id === id) {
              return {
                ...task,
                output: {
                  ...task.output,
                  path,
                },
              };
            } else {
              return task;
            }
          })
        );
      },
      [setRecords]
    );

    /**
     * On args source change of input or output args
     */
    const onSelectChange = useCallback(
      (
        { id }: ModifyingTaskArgsItem,
        selection: TaskArgsSource.Auto | TaskArgsSource.Custom | Preset,
        type: "input" | "output"
      ) => {
        setRecords((state) =>
          state.map((task) => {
            if (task[type].id === id) {
              if (selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom) {
                return {
                  ...task,
                  [type]: {
                    ...task[type],
                    selection,
                  },
                };
              } else {
                // tries replacing extension if a preset selected
                return {
                  ...task,
                  [type]: {
                    ...task[type],
                    selection,
                    path: task[type].path
                      ? replaceExtension(task[type].path!, selection)
                      : task[type].path,
                  },
                };
              }
            } else {
              return task;
            }
          })
        );
      },
      [setRecords]
    );

    /**
     * On change custom args of input or output args
     */
    const onCustomChange = useCallback(
      ({ id }: ModifyingTaskArgsItem, custom: string, type: "input" | "output") => {
        setRecords((state) =>
          state.map((task) => {
            if (task[type].id === id) {
              return {
                ...task,
                [type]: {
                  ...task[type],
                  custom,
                },
              };
            } else {
              return task;
            }
          })
        );
      },
      [setRecords]
    );

    /**
     * On apply one input or output args to all
     */
    const onApplyAll = useCallback(
      ({ id, selection, custom }: ModifyingTaskArgsItem, type: "input" | "output") => {
        setRecords((state) =>
          state.map((task) => {
            if (task[type].id === id) {
              return task;
            } else {
              if (selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom) {
                return { ...task, [type]: { ...task[type], selection, custom } };
              } else {
                return {
                  ...task,
                  [type]: {
                    ...task[type],
                    selection,
                    custom,
                    path: task[type].path
                      ? replaceExtension(task[type].path!, selection)
                      : task[type].path,
                  },
                };
              }
            }
          })
        );
      },
      [setRecords]
    );

    /**
     * On apply one input or output args as custom
     */
    const onConvertCustom = useCallback(
      ({ id, selection, custom }: ModifyingTaskArgsItem, type: "input" | "output") => {
        setRecords((state) =>
          state.map((record) => {
            if (record[type].id !== id) {
              return record;
            } else {
              return {
                ...record,
                [type]: {
                  ...record[type],
                  selection: TaskArgsSource.Custom,
                  custom:
                    selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom
                      ? custom
                      : selection.args.join(" "),
                },
              };
            }
          })
        );
      },
      [setRecords]
    );

    /**
     * On remove task
     */
    const onRemove = useCallback(
      (id: string) => {
        setRecords((state) => state.filter((record) => record.id !== id));
      },
      [setRecords]
    );

    const columns: TableColumnProps<SimpleTaskArgs>[] = useMemo(
      () => [
        {
          title: "Input File",
          render: (_col, task) => task.input.path ?? "NULL",
        },
        {
          title: "Decode Arguments",
          width: "20%",
          render: (_col, task) => (
            <CodecModifier
              presetType={PresetType.Decode}
              record={task.input}
              onSelectChange={(record, selection) => {
                onSelectChange(record, selection, "input");
              }}
              onCustomChange={(record, custom) => {
                onCustomChange(record, custom, "input");
              }}
              onApplyAll={(args) => {
                onApplyAll(args, "input");
              }}
              onConvertCustom={(args) => {
                onConvertCustom(args, "input");
              }}
            />
          ),
        },
        {
          title: "Output File",
          render: (_col, task) => (
            <OutputFileModifier
              args={task.output}
              onChange={(path) => onOutputFileChange(task.id, path)}
            />
          ),
        },
        {
          title: "Encode Arguments",
          width: "20%",
          render: (_col, task) => (
            <CodecModifier
              presetType={PresetType.Encode}
              record={task.output}
              onSelectChange={(record, selection) => {
                onSelectChange(record, selection, "output");
              }}
              onCustomChange={(record, custom) => {
                onCustomChange(record, custom, "output");
              }}
              onApplyAll={(args) => {
                onApplyAll(args, "output");
              }}
              onConvertCustom={(args) => {
                onConvertCustom(args, "output");
              }}
            />
          ),
        },
        {
          title: "Operations",
          width: "6rem",
          align: "center",
          render: (_col, task) => (
            <Button
              size="mini"
              shape="circle"
              type="primary"
              status="danger"
              icon={<IconDelete />}
              onClick={() => onRemove(task.id)}
            ></Button>
          ),
        },
      ],
      [onSelectChange, onCustomChange, onApplyAll, onConvertCustom, onOutputFileChange, onRemove]
    );

    /**
     * Exports methods
     */
    useImperativeHandle(
      ref,
      () => {
        return {
          addTasksFromInputFiles: async (...inputFiles: string[]) => {
            const records = await toSimpleTaskArgs(
              inputFiles,
              configuration.saveDirectory,
              defaultDecode,
              defaultEncode
            );
            setRecords((state) => [...state, ...records]);
          },
        } as SimpleTasksModifierInstance;
      },
      [configuration.saveDirectory, defaultDecode, defaultEncode]
    );

    return (
      <Modal
        simple
        escToExit={!modified}
        maskClosable={!modified}
        getChildrenPopupContainer={() => document.body}
        style={{
          width: "90%",
          maxHeight: "80%",
        }}
        visible={visible}
        footer={<Footer modified={modified} records={records} onVisibleChange={onVisibleChange} />}
        afterClose={() => {
          setRecords([]);
        }}
        onCancel={() => {
          onVisibleChange(false);
        }}
      >
        {/* Buttons */}
        <Space className="mb-4">
          {/* Add Input Files Button */}
          <Button size="small" type="primary" onClick={addInputFiles}>
            Add Input Files
          </Button>
        </Space>

        {/* Input Files Table */}
        <Table
          stripe
          size="mini"
          rowKey="id"
          pagination={false}
          columns={columns}
          data={records}
          scroll={{ y: "calc(80vh - 190px)" }}
        ></Table>
      </Modal>
    );
  }
);

export default SimpleTasksModifier;
