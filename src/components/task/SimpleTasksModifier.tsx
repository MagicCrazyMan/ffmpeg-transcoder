import { Button, Modal, Popconfirm, Space, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDelete } from "@arco-design/web-react/icon";
import { open } from "@tauri-apps/api/dialog";
import { join, sep } from "@tauri-apps/api/path";
import { useCallback, useMemo, useState } from "react";
import { v4 } from "uuid";
import { TaskParamsModifyingValue } from ".";
import { PresetType } from "../../libs/preset";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";
import {
  ParamsSource,
  TaskInputParams,
  TaskOutputParams,
  TaskParams,
  useTaskStore,
} from "../../store/task";
import { toTaskParams } from "../../utils";
import CodecModifier, { TaskParamsCodecValue } from "./CodecModifier";
import OutputFileModifier from "./OutputFileModifier";

export type SimpleTasksAddingProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

type SimpleTaskParams = {
  id: string;
  input: TaskParamsModifyingValue;
  output: TaskParamsModifyingValue;
};

const Footer = ({
  records,
  onVisibleChange,
}: {
  records: SimpleTaskParams[];
  onVisibleChange: (visible: boolean) => void;
}) => {
  const { addTasks } = useTaskStore();
  const presets = usePresetStore((state) => state.storage.presets);

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

export default function SimpleTasksModifier({ visible, onVisibleChange }: SimpleTasksAddingProps) {
  const { configuration, openDialogFilters } = useAppStore();
  const { storage } = usePresetStore();

  const [tasks, setTasks] = useState<SimpleTaskParams[]>([]);

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
      const promises = files.map(async (file) => {
        let defaultOutputPath: string | undefined;
        if (configuration.saveDirectory) {
          const filename = file.split(sep).pop();
          if (filename) defaultOutputPath = await join(configuration.saveDirectory, filename);
        }

        return {
          id: v4(),
          input: {
            id: v4(),
            path: file,
            selection: storage.defaultDecode ?? ParamsSource.Auto,
          },
          output: {
            id: v4(),
            path: defaultOutputPath,
            selection: storage.defaultEncode ?? ParamsSource.Auto,
          },
        } as SimpleTaskParams;
      });
      const records = await Promise.all(promises);
      setTasks((state) => [...state, ...records]);
    }
  };

  /**
   * On select output files vis Tauri
   */
  const onOutputFileChange = useCallback((id: string, path: string) => {
    setTasks((state) =>
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
  }, []);

  /**
   * On change input or output params
   */
  const onChange = useCallback(
    (id: string, values: Partial<TaskParamsCodecValue>, type: "input" | "output") => {
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
    (id: string, values: Partial<TaskParamsCodecValue>) => {
      onChange(id, values, "input");
    },
    [onChange]
  );
  const onChangeOutputs = useCallback(
    (id: string, values: Partial<TaskParamsCodecValue>) => {
      onChange(id, values, "output");
    },
    [onChange]
  );

  /**
   * On apply one input or output params to all
   */
  const onApplyAll = useCallback(
    ({ id, selection, custom }: TaskParamsCodecValue, type: "input" | "output") => {
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
    (params: TaskParamsCodecValue) => {
      onApplyAll(params, "input");
    },
    [onApplyAll]
  );
  const onApplyAllOutputs = useCallback(
    (params: TaskParamsCodecValue) => {
      onApplyAll(params, "output");
    },
    [onApplyAll]
  );

  /**
   * On apply one input or output params as custom
   */
  const onConvertCustom = useCallback(
    ({ id, selection }: TaskParamsCodecValue, type: "input" | "output") => {
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
                custom: storage.presets.find((preset) => preset.id === selection)?.params.join(" "),
              },
            };
          }
        })
      );
    },
    [storage.presets, setTasks]
  );
  const onConvertCustomInputs = useCallback(
    (params: TaskParamsCodecValue) => {
      onConvertCustom(params, "input");
    },
    [onConvertCustom]
  );
  const onConvertCustomOutputs = useCallback(
    (params: TaskParamsCodecValue) => {
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

  const columns: TableColumnProps<SimpleTaskParams>[] = useMemo(
    () => [
      {
        title: "Input File",
        render: (_col, task) => task.input.path ?? "NULL",
      },
      {
        title: "Decode Params",
        width: "20%",
        render: (_col, task) => (
          <CodecModifier
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
        render: (_col, task) => (
          <OutputFileModifier
            params={task.output}
            onChange={(path) => onOutputFileChange(task.id, path)}
          />
        ),
      },
      {
        title: "Encode Params",
        width: "20%",
        render: (_col, task) => (
          <CodecModifier
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
    [
      onRemove,
      onOutputFileChange,
      onChangeInputs,
      onChangeOutputs,
      onApplyAllInputs,
      onApplyAllOutputs,
      onConvertCustomInputs,
      onConvertCustomOutputs,
    ]
  );

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
        data={tasks}
      ></Table>
    </Modal>
  );
}
