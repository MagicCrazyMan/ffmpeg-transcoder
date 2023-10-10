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
import { IconCheck, IconDelete } from "@arco-design/web-react/icon";
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

const EditableContext = createContext<{ getForm?: () => FormInstance<Preset> | null }>({});

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
const EditableRow = ({ children, record, className, ...rest }: any) => {
  const refForm = useRef<FormInstance<Preset>>(null);
  const getForm = () => refForm.current;

  return (
    <EditableContext.Provider
      value={{
        getForm,
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
    rules?: RulesProps[];
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
    rules: [{ required: true }],
  },
  /**
   * for remark field
   */
  remark: {
    cell({ children }: EditableCellProps<"remark">): ReactNode {
      return <div className="inline-block">{children}</div>;
    },
    editingCell(_props: EditableCellProps<"remark">, submit): ReactNode {
      return <Input.TextArea autoFocus autoSize onPressEnter={submit} />;
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
    rules: [{ required: true }],
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
      return <InputTag allowClear autoFocus saveOnBlur validate={(value) => !!value}></InputTag>;
    },
    rules: [{ required: true }],
  },
};

const EditableCell = (props: EditableCellProps<keyof Preset>) => {
  const { children, className, rowData, column, onHandleSave } = props;
  const cellContainerRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const { getForm } = useContext(EditableContext);

  /**
   * Submits and saves data
   */
  const submit = useCallback(() => {
    const form = getForm?.();
    if (form) {
      form.validate([column.dataIndex! as keyof Preset]).then((preset) => {
        if (onHandleSave) onHandleSave({ ...rowData, ...preset });
        setEditing(false);
      });
    } else {
      setEditing(false);
    }
  }, [getForm, onHandleSave, rowData, column]);

  /**
   * Listens on click event and tries to stop and save editing value when click outside editable cell
   */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // do nothing if not editable or not editing
      if (!column.editable || !editing) return;
      // do nothing if click on form item itself
      if (
        !cellContainerRef.current ||
        !e.target ||
        cellContainerRef.current.contains(e.target as HTMLElement)
      )
        return;

      submit();
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [editing, column, submit]);

  if (!column.editable) return <div className={className}>{children}</div>;

  if (editing) {
    return (
      <div ref={cellContainerRef}>
        <Form.Item
          style={{ marginBottom: 0 }}
          labelCol={{ span: 0 }}
          wrapperCol={{ span: 24 }}
          field={column.dataIndex}
          rules={editableCells[column.dataIndex!].rules}
        >
          {editableCells[column.dataIndex!].editingCell(props, submit)}
        </Form.Item>
      </div>
    );
  } else {
    return (
      <div
        className="w-full h-full"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {editableCells[column.dataIndex!].cell(props)}
      </div>
    );
  }
};

export default function PresetsPage() {
  const presets = usePresetStore((state) => state.presets);
  const updatePreset = usePresetStore((state) => state.updatePreset);
  const removePreset = usePresetStore((state) => state.removePreset);
  const tempPreset = usePresetStore((state) => state.tempPreset);
  const enableTempPreset = usePresetStore((state) => state.enableTempPreset);
  const disableTempPreset = usePresetStore((state) => state.disableTempPreset);
  const updateTempPreset = usePresetStore((state) => state.updateTempPreset);
  const persistTempPreset = usePresetStore((state) => state.persistTempPreset);

  /**
   * Save preset when cell value change
   */
  const onCell = useCallback(
    (_: Preset, index: number) => {
      return {
        onHandleSave: (row: Preset) => {
          if (index > presets.length - 1) {
            updateTempPreset(row);
          } else {
            updatePreset(index, row);
          }
        },
      };
    },
    [presets, updateTempPreset, updatePreset]
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
            {index > presets.length - 1 ? (
              <Button
                shape="circle"
                type="primary"
                icon={<IconCheck />}
                onClick={persistTempPreset}
              ></Button>
            ) : null}
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
      <Button type="primary" size="small" onClick={enableTempPreset}>
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
