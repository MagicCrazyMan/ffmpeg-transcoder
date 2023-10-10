import {
  Button,
  Form,
  FormInstance,
  Input,
  InputTag,
  RulesProps,
  Select,
  Space,
  Table,
  TableColumnProps,
  Tag,
} from "@arco-design/web-react";
import { ColumnProps } from "@arco-design/web-react/es/Table";
import { IconDelete } from "@arco-design/web-react/icon";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Preset, PresetType, usePresetStore } from "../store/preset";

const EditableContext = createContext<{
  getForm: () => FormInstance<Preset> | null;
  getIndex: () => number;
} | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
const EditableRow = ({ children, record, className, index, ...rest }: any) => {
  const refForm = useRef<FormInstance<Preset>>(null);
  const getForm = () => refForm.current;

  const getIndex = useCallback(() => index, [index]);

  return (
    <EditableContext.Provider
      value={{
        getForm,
        getIndex,
      }}
    >
      <Form
        size="mini"
        wrapper="tr"
        children={children}
        initialValues={record}
        ref={refForm}
        wrapperProps={rest}
        className={`${className} table-row`}
      />
    </EditableContext.Provider>
  );
};

type EditableCellProps<Key extends keyof Preset> = {
  rowData: Preset;
  className: string;
  column: ColumnProps<Preset>;
  children: Preset[Key];
  onHandleSave: (row: Preset) => void;
};

/**
 * Editable cells.
 */
const editableCells: Record<
  string,
  {
    cell(props: EditableCellProps<keyof Preset>): ReactNode;
    editingCell(props: EditableCellProps<keyof Preset>, submit: () => void): ReactNode;
    rules: (
      presets: Preset[],
      index: number,
      props: EditableCellProps<keyof Preset>
    ) => RulesProps[];
  }
> = {
  /**
   * for name field
   */
  name: {
    cell({ children }: EditableCellProps<"name">): ReactNode {
      return <div className="inline-block">{children}</div>;
    },
    editingCell(_props: EditableCellProps<"name">, submit): ReactNode {
      return <Input autoFocus onPressEnter={submit} />;
    },
    rules(presets, index) {
      return [
        { required: true },
        {
          validator(value, callback) {
            if (presets.some((preset, i) => index !== i && preset.name === value)) {
              callback("name already exists");
            } else {
              callback();
            }
          },
        },
      ];
    },
  },
  /**
   * for remark field
   */
  remark: {
    cell({ children }: EditableCellProps<"remark">): ReactNode {
      return <div className="inline-block">{children}</div>;
    },
    editingCell(_props: EditableCellProps<"remark">, submit): ReactNode {
      return <Input.TextArea autoSize onPressEnter={submit} />;
    },
    rules() {
      return [];
    },
  },
  /**
   * for type field
   */
  type: {
    cell({ children }: EditableCellProps<"type">): ReactNode {
      switch (children) {
        case PresetType.Universal:
          return "Universal";
        case PresetType.Decode:
          return "For Decode Only";
        case PresetType.Encode:
          return "For Encode Only";
      }
    },
    editingCell(): ReactNode {
      return (
        <Select>
          <Select.Option key={PresetType.Universal} value={PresetType.Universal}>
            Universal
          </Select.Option>
          <Select.Option key={PresetType.Decode} value={PresetType.Decode}>
            For Decode Only
          </Select.Option>
          <Select.Option key={PresetType.Encode} value={PresetType.Encode}>
            For Encode Only
          </Select.Option>
        </Select>
      );
    },
    rules() {
      return [{ required: true }];
    },
  },
  /**
   * for params field
   */
  params: {
    cell({ children }: EditableCellProps<"params">): ReactNode {
      const tags = children.map((param, index) => <Tag key={index}>{param}</Tag>);
      return (
        <Space wrap size={2}>
          {tags}
        </Space>
      );
    },
    editingCell(): ReactNode {
      // allow duplicated tags
      return <InputTag allowClear saveOnBlur validate={(value) => !!value}></InputTag>;
    },
    rules() {
      return [{ required: true, empty: false }];
    },
  },
};

const EditableCell = (props: EditableCellProps<keyof Preset>) => {
  const { children, className, rowData, column, onHandleSave } = props;

  const { getForm, getIndex } = useContext(EditableContext)!;
  const presets = usePresetStore((state) => state.presets);

  const cellRef = useRef<HTMLDivElement | null>(null);
  const isTempPreset = useMemo(() => getIndex() > presets.length - 1, [getIndex, presets]);
  const [editing, setEditing] = useState(isTempPreset);

  /**
   * Submits and saves data
   */
  const submit = useCallback(() => {
    const form = getForm?.();
    if (!form) return;

    if (isTempPreset) {
      // for a temporary preset, saves only when all fields are passed.
      form.validate().then((preset) => {
        if (onHandleSave) onHandleSave(preset);
        setEditing(false);
      });
    } else {
      form.validate([column.dataIndex! as keyof Preset]).then((partial) => {
        if (onHandleSave) onHandleSave({ ...rowData, ...partial });
        setEditing(false);
      });
    }
  }, [getForm, onHandleSave, rowData, column, isTempPreset]);

  /**
   * Listens on click event and tries to stop and save editing value when click outside editing cell
   */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // do nothing if not editable or not editing
      if (!column.editable || !editing) return;
      // do nothing if click on editing cell itself
      if (!cellRef.current || !e.target || cellRef.current.contains(e.target as HTMLElement))
        return;

      submit();
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [column, submit, presets, editing, getIndex]);

  // returns children if cell not editable
  if (!column.editable) return <div className={className}>{children}</div>;

  // returns editing cell if cell is temporary preset or cell is current editing
  if (editing) {
    return (
      <div ref={cellRef}>
        <Form.Item
          style={{ marginBottom: 0 }}
          labelCol={{ span: 0 }}
          wrapperCol={{ span: 24 }}
          field={column.dataIndex}
          rules={editableCells[column.dataIndex!].rules(presets, getIndex(), props)}
        >
          {editableCells[column.dataIndex!].editingCell(props, submit)}
        </Form.Item>
      </div>
    );
  }

  // returns a cell that could enable editing by clicking on it
  return (
    <div className="w-full h-full" onClick={() => setEditing(true)}>
      {editableCells[column.dataIndex!].cell(props)}
    </div>
  );
};

export default function PresetsPage() {
  const {
    presets,
    updatePreset,
    removePreset,
    tempPreset,
    enableTempPreset,
    disableTempPreset,
    updateTempPreset,
    persistTempPreset,
  } = usePresetStore((state) => state);

  /**
   * Save preset when cell value change
   */
  const onCell = useCallback(
    (_: Preset, index: number) => {
      return {
        onHandleSave: (row: Preset) => {
          if (index > presets.length - 1) {
            updateTempPreset(row);
            // tries to persist it immediately
            persistTempPreset();
          } else {
            updatePreset(index, row);
          }
        },
      };
    },
    [presets, updatePreset, updateTempPreset, persistTempPreset]
  );

  /**
   * Remove preset
   */
  const remove = useCallback(
    (index: number) => {
      if (index > presets.length - 1) {
        disableTempPreset();
      } else {
        removePreset(index);
      }
    },
    [presets, disableTempPreset, removePreset]
  );

  const tableCols: TableColumnProps[] = [
    {
      title: "Name",
      dataIndex: "name",
      width: "20%",
      editable: true,
      onCell,
    },
    {
      title: "Type",
      dataIndex: "type",
      width: "200px",
      editable: true,
      onCell,
    },
    {
      title: "Params",
      dataIndex: "params",
      editable: true,
      onCell,
    },
    {
      title: "Remark",
      dataIndex: "remark",
      width: "20%",
      editable: true,
      onCell,
    },
    {
      title: "Operations",
      width: "120px",
      align: "center",
      render: (_, _record, index) => {
        return (
          <Space>
            <Button
              shape="circle"
              type="primary"
              status="danger"
              icon={<IconDelete />}
              onClick={() => remove(index)}
            ></Button>
          </Space>
        );
      },
    },
  ];
  const tableData = useMemo(
    () => (tempPreset ? [...presets, tempPreset] : presets),
    [presets, tempPreset]
  );

  return (
    <Space className="w-full" direction="vertical">
      {/* Add Preset */}
      <Button
        type="primary"
        size="small"
        disabled={!!tempPreset}
        onClick={(e) => {
          // stop propagation to prevent form validation
          e.stopPropagation();
          enableTempPreset();
        }}
      >
        Add Preset
      </Button>

      {/* Presets Table */}
      <Table
        stripe
        pagination={false}
        size="mini"
        rowKey="name"
        columns={tableCols}
        data={tableData}
        components={{
          body: {
            row: EditableRow,
            cell: EditableCell,
          },
        }}
      ></Table>
    </Space>
  );
}
