import {
  Button,
  Form,
  FormInstance,
  Input,
  InputTag,
  Select,
  Space,
  Table,
  TableColumnProps,
  Tag,
} from "@arco-design/web-react";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
const EditableCell = ({ children, className, rowData, column, onHandleSave }: any) => {
  const cellContainerRef = useRef<HTMLDivElement | null>(null);
  const { getForm } = useContext(EditableContext);
  const [editing, setEditing] = useState(false);

  /**
   * Submits and saves data
   */
  const submit = useCallback(() => {
    const form = getForm?.();
    if (form) {
      form.validate([column.dataIndex]).then((preset) => {
        if (onHandleSave) onHandleSave({ ...rowData, ...preset });
        setEditing(false);
      });
    } else {
      setEditing(false);
    }
  }, [column, getForm, rowData, onHandleSave]);

  /**
   * Listens on click event and tries to stop and save editing value when click outside editable cell
   */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // do nothing if not editable
      if (!column.editable) return;
      // do nothing if click on form item itself
      if (
        !cellContainerRef.current ||
        !e.target ||
        cellContainerRef.current.contains(e.target as HTMLElement)
      )
        return;

      if (editing) {
        submit();
      } else {
        setEditing(true);
      }
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [editing, column, submit]);

  if (!column.editable) return <div className={className}>{children}</div>;

  if (editing) {
    let inputField: ReactNode;
    switch (column.dataIndex) {
      case "name":
        inputField = <Input autoFocus onPressEnter={submit} />;
        break;
      case "type":
        inputField = (
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
        break;
      case "params":
        inputField = <InputTag allowClear saveOnBlur></InputTag>;
        break;
    }

    return (
      <div ref={cellContainerRef}>
        <Form.Item
          style={{ marginBottom: 0 }}
          labelCol={{ span: 0 }}
          wrapperCol={{ span: 24 }}
          field={column.dataIndex}
          rules={[{ required: true }]}
        >
          {inputField}
        </Form.Item>
      </div>
    );
  } else {
    let node: ReactNode;
    switch (column.dataIndex) {
      case "name":
        node = children;
        break;
      case "type": {
        switch (rowData.type) {
          case PresetType.Universal:
            node = "Universal";
            break;
          case PresetType.Decode:
            node = "For Decode Only";
            break;
          case PresetType.Encode:
            node = "For Encode Only";
            break;
        }
        break;
      }
      case "params": {
        const tags = rowData.params.map((param: string, index: number) => (
          <Tag key={index}>{param}</Tag>
        ));
        node = <Space size={2}>{tags}</Space>;
        break;
      }
    }

    return <div onClick={() => setEditing(true)}>{node}</div>;
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
      width: "20%",
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
      title: "Operations",
      width: "120px",
      align: "center",
      render: (_, _record, index) => {
        if (index > presets.length - 1) {
          return (
            <Space>
              <Button
                shape="circle"
                type="primary"
                icon={<IconCheck />}
                onClick={persistTempPreset}
              ></Button>
              <Button
                shape="circle"
                type="primary"
                status="danger"
                icon={<IconDelete />}
                onClick={() => remove(index)}
              ></Button>
            </Space>
          );
        } else {
          return (
            <Button
              shape="circle"
              type="primary"
              status="danger"
              icon={<IconDelete />}
              onClick={() => remove(index)}
            ></Button>
          );
        }
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
