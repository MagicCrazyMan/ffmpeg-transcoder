import {
  Button,
  Modal,
  Popconfirm,
  Space,
  Table,
  TableColumnProps,
  Tooltip,
  Typography,
} from "@arco-design/web-react";
import { IconDelete, IconFolder } from "@arco-design/web-react/icon";
import { open, save } from "@tauri-apps/api/dialog";
import { useCallback, useMemo, useState } from "react";
import { v4 } from "uuid";
import { toTaskParams } from ".";
import { useAppStore } from "../../store/app";
import { PresetType, usePresetStore } from "../../store/preset";
import {
  ParamsSource,
  TaskInputParams,
  TaskOutputParams,
  TaskParams,
  useTaskStore,
} from "../../store/task";
import { EditableTaskInputParams, EditableTaskOutputParams } from "./";
import ParamsModifier from "./ParamsModifier";

export type SimpleTasksAddingProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

type SimpleTaskParams = {
  id: string;
  input: EditableTaskInputParams;
  output: EditableTaskOutputParams;
};

const Operations = ({
  task,
  onRemove,
}: {
  task: SimpleTaskParams;
  onRemove: (id: string) => void;
}) => {
  return (
    <Space>
      {/* Delete Button */}
      <Button
        size="mini"
        shape="circle"
        type="primary"
        status="danger"
        icon={<IconDelete />}
        onClick={() => onRemove(task.id)}
      ></Button>
    </Space>
  );
};

const Footer = ({
  records,
  onVisibleChange,
}: {
  records: SimpleTaskParams[];
  onVisibleChange: (visible: boolean) => void;
}) => {
  const { addTasks } = useTaskStore((state) => state);
  const presets = usePresetStore((state) => state.presets);

  const modified = useMemo(() => records.length !== 0, [records]);

  const onCancel = () => onVisibleChange(false);
  const onSubmit = () => {
    addTasks(
      ...records.map(
        (record) =>
          ({
            inputs: [toTaskParams(record.input, presets) as TaskInputParams],
            outputs: [toTaskParams(record.output, presets) as TaskOutputParams],
          }) as TaskParams
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

export default function SimpleTasksAdding({ visible, onVisibleChange }: SimpleTasksAddingProps) {
  const { configuration, openDialogFilters, saveDialogFilters } = useAppStore((state) => state);
  const { presets, defaultDecode, defaultEncode } = usePresetStore((state) => state);

  const [tasks, setTasks] = useState<SimpleTaskParams[]>([]);

  /**
   * On change input or output params
   */
  const onChange = useCallback(
    (
      id: string,
      values: Partial<EditableTaskInputParams | EditableTaskOutputParams>,
      type: "input" | "output"
    ) => {
      setTasks((state) =>
        state.map((task) => {
          if (task[type].id !== id) {
            return task;
          } else {
            return {
              ...task,
              [type]: {
                ...task[type],
                ...values,
              },
            };
          }
        })
      );
    },
    [setTasks]
  );
  const onChangeInputs = useCallback(
    (id: string, values: Partial<EditableTaskInputParams | EditableTaskOutputParams>) => {
      onChange(id, values, "input");
    },
    [onChange]
  );
  const onChangeOutputs = useCallback(
    (id: string, values: Partial<EditableTaskInputParams | EditableTaskOutputParams>) => {
      onChange(id, values, "output");
    },
    [onChange]
  );

  /**
   * On apply one input or output params to all
   */
  const onApplyAll = useCallback(
    (
      { id, selection, custom }: EditableTaskInputParams | EditableTaskOutputParams,
      type: "input" | "output"
    ) => {
      setTasks((state) =>
        state.map((task) => {
          if (task[type].id === id) {
            return task;
          } else {
            return { ...task, [type]: { ...task[type], selection, custom } };
          }
        })
      );
    },
    [setTasks]
  );
  const onApplyAllInputs = useCallback(
    (params: EditableTaskInputParams | EditableTaskOutputParams) => {
      onApplyAll(params, "input");
    },
    [onApplyAll]
  );
  const onApplyAllOutputs = useCallback(
    (params: EditableTaskInputParams | EditableTaskOutputParams) => {
      onApplyAll(params, "output");
    },
    [onApplyAll]
  );

  /**
   * On apply one input or output params as custom
   */
  const onConvertCustom = useCallback(
    (
      { id, selection }: EditableTaskInputParams | EditableTaskOutputParams,
      type: "input" | "output"
    ) => {
      setTasks((state) =>
        state.map((task) => {
          if (task[type].id !== id) {
            return task;
          } else {
            return {
              ...task,
              [type]: {
                ...task[type],
                selection: ParamsSource.Custom,
                custom: presets.find((preset) => preset.id === selection)?.params.join(" "),
              },
            };
          }
        })
      );
    },
    [presets, setTasks]
  );
  const onConvertCustomInputs = useCallback(
    (params: EditableTaskInputParams | EditableTaskOutputParams) => {
      onConvertCustom(params, "input");
    },
    [onConvertCustom]
  );
  const onConvertCustomOutputs = useCallback(
    (params: EditableTaskInputParams | EditableTaskOutputParams) => {
      onConvertCustom(params, "output");
    },
    [onConvertCustom]
  );

  /**
   * On remove task
   */
  const onRemove = useCallback(
    (id: string) => {
      setTasks((state) => state.filter((record) => record.id !== id));
    },
    [setTasks]
  );

  /**
   * On select output files vis Tauri
   */
  const onSelectOutputFile = useCallback(
    async (id: string) => {
      const file = await save({
        title: "Select Output File",
        defaultPath: configuration.saveDirectory,
        filters: saveDialogFilters,
      });

      if (file) {
        setTasks((state) =>
          state.map((task) => {
            if (task.id === id) {
              return {
                ...task,
                output: {
                  ...task.output,
                  path: file,
                },
              };
            } else {
              return task;
            }
          })
        );
      }
    },
    [configuration.saveDirectory, saveDialogFilters]
  );

  const columns: TableColumnProps<SimpleTaskParams>[] = useMemo(
    () => [
      {
        title: "Input File",
        ellipsis: true,
        render: (_col, task) => task.input.path ?? "NULL",
      },
      {
        title: "Decode Params",
        width: "20%",
        render: (_col, task) => (
          <ParamsModifier
            presetType={PresetType.Decode}
            record={task.input}
            onChange={onChangeInputs}
            onApplyAll={onApplyAllInputs}
            onConvertCustom={onConvertCustomInputs}
          />
        ),
      },
      {
        title: "Output File",
        ellipsis: true,
        render: (_col, task) => (
          <div className="flex gap-2 items-center">
            {/* Select Output File Button */}
            <Tooltip content="Select Output File">
              <Button
                shape="circle"
                size="mini"
                type="primary"
                className="flex-shrink-0"
                icon={<IconFolder />}
                onClick={() => onSelectOutputFile(task.id)}
              />
            </Tooltip>

            {/* File Name */}
            <Typography.Text ellipsis editable className="flex-1" style={{ margin: "0" }}>
              {task.output.path ?? "NULL"}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: "Encode Params",
        width: "20%",
        render: (_col, task) => (
          <ParamsModifier
            presetType={PresetType.Encode}
            record={task.output}
            onChange={onChangeOutputs}
            onApplyAll={onApplyAllOutputs}
            onConvertCustom={onConvertCustomOutputs}
          />
        ),
      },
      {
        title: "Operations",
        width: "6rem",
        align: "center",
        render: (_col, task) => <Operations task={task} onRemove={onRemove} />,
      },
    ],
    [
      onRemove,
      onSelectOutputFile,
      onChangeInputs,
      onChangeOutputs,
      onApplyAllInputs,
      onApplyAllOutputs,
      onConvertCustomInputs,
      onConvertCustomOutputs,
    ]
  );

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
      const records: SimpleTaskParams[] = files.map((file) => ({
        id: v4(),
        input: {
          id: v4(),
          path: file,
          selection: defaultDecode ?? ParamsSource.Auto,
        },
        output: {
          id: v4(),
          selection: defaultEncode ?? ParamsSource.Auto,
        },
      }));
      setTasks((state) => [...state, ...records]);
    }
  };

  return (
    <Modal
      simple
      maskClosable={false}
      getChildrenPopupContainer={() => document.body}
      style={{
        width: "90%",
        maxHeight: "80%",
        overflowY: "auto",
      }}
      visible={visible}
      footer={<Footer records={tasks} onVisibleChange={onVisibleChange} />}
      afterClose={() => {
        setTasks([]);
      }}
    >
      <Space direction="vertical">
        {/* Buttons */}
        <Space>
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
          data={tasks}
        ></Table>
      </Space>
    </Modal>
  );
}
