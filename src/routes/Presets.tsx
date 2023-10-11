import {
  Button,
  Form,
  FormInstance,
  Input,
  InputTag,
  Popconfirm,
  RulesProps,
  Select,
  Space,
  Table,
  TableColumnProps,
  Tag,
  Tooltip,
} from "@arco-design/web-react";
import { ColumnProps } from "@arco-design/web-react/es/Table";
import { IconCopy, IconDelete, IconDragDotVertical, IconPlus } from "@arco-design/web-react/icon";
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
import { unstable_useBlocker } from "react-router-dom";
import { SortableContainer, SortableElement, SortableHandle } from "react-sortable-hoc";
import { Preset, PresetType, usePresetStore } from "../store/preset";

type RowProps = {
  className: string;
  children: ReactNode[];
  record: Preset;
  rowIndex: number;
};

type CellProps<Key extends keyof Preset> = {
  rowData: Preset;
  className: string;
  column: ColumnProps<Preset>;
  children: Preset[Key];
  onHandleSave: (row: Preset) => void;
};

const EditableContext = createContext<{
  getForm: () => FormInstance<Preset> | null;
  getRowIndex: () => number;
} | null>(null);

/**
 * Editable Row Component
 */
const EditableRow = ({ children, record, className, rowIndex, ...rest }: RowProps) => {
  const refForm = useRef<FormInstance<Preset>>(null);
  const getForm = () => refForm.current;

  const getRowIndex = useCallback(() => rowIndex, [rowIndex]);

  return (
    <EditableContext.Provider
      value={{
        getForm,
        getRowIndex,
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

const editableCells: Record<
  string,
  {
    cell(props: CellProps<keyof Preset>): ReactNode;
    editingCell(props: CellProps<keyof Preset>, submit: () => void): ReactNode;
    rules: (presets: Preset[], index: number, props: CellProps<keyof Preset>) => RulesProps[];
  }
> = {
  /**
   * for name field
   */
  name: {
    cell({ children }: CellProps<"name">): ReactNode {
      return <div className="inline-block">{children}</div>;
    },
    editingCell(_props: CellProps<"name">, submit): ReactNode {
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
    cell({ children }: CellProps<"remark">): ReactNode {
      return <div className="inline-block">{children}</div>;
    },
    editingCell(_props: CellProps<"remark">, submit): ReactNode {
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
    cell({ children }: CellProps<"type">): ReactNode {
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
    cell({ children }: CellProps<"params">): ReactNode {
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

/**
 * Editable Cell Component
 */
const EditableCell = (props: CellProps<keyof Preset>) => {
  const { children, className, rowData, column, onHandleSave } = props;

  const { getForm, getRowIndex } = useContext(EditableContext)!;
  const presets = usePresetStore((state) => state.presets);

  const cellRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(!!rowData.isTemp);

  /**
   * Submits and saves data
   */
  const submit = useCallback(() => {
    const form = getForm?.();
    if (!form) return;

    if (rowData.isTemp) {
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
  }, [getForm, onHandleSave, rowData, column]);

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
      // for clicking on select options
      const acroSelectClassList = ["arco-select-popup", "arco-select-option"];
      if (
        e.target &&
        Array.from<string>((e.target as HTMLElement).classList.values()).some((className) =>
          acroSelectClassList.includes(className)
        )
      )
        return;

      submit();
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [column, submit, presets, editing, getRowIndex]);

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
          rules={editableCells[column.dataIndex!].rules(presets, getRowIndex(), props)}
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

/**
 * Drag handler component
 */
const DragHandler = SortableHandle(() => (
  <IconDragDotVertical
    style={{
      cursor: "move",
      color: "#555",
    }}
  />
));

/**
 * Sortable table dragger wrapper component
 */
const SortableWrapper = SortableContainer((props: { children: ReactNode[] }) => (
  <tbody {...props} />
));

/**
 * Sortable element wrapped editable row component
 */
const SortableEditableItem = SortableElement((props: RowProps) => <EditableRow {...props} />);

/**
 * A page managing user-defined decode and encode params presets.
 */
export default function PresetsPage() {
  const {
    presets,
    movePreset,
    copyPreset,
    updatePreset,
    removePreset,
    tempPreset,
    enableTempPreset,
    disableTempPreset,
    updateTempPreset,
    persistTempPreset,
  } = usePresetStore((state) => state);

  /**
   * Block leaving page if temporary preset is editing
   */
  const isBlocking = useMemo(() => !!tempPreset, [tempPreset]);
  const blocker = unstable_useBlocker(isBlocking);
  useEffect(() => {
    if (blocker.state === "blocked" && !isBlocking) {
      blocker.reset();
    }
  }, [blocker, isBlocking]);

  /**
   * Save preset when cell value change
   */
  const onCell = useCallback(
    (_: Preset, index: number) => {
      return {
        onHandleSave: (row: Preset) => {
          if (row.isTemp) {
            updateTempPreset(row);
            // tries to persist it immediately
            persistTempPreset();
          } else {
            updatePreset(index, row);
          }
        },
      };
    },
    [updatePreset, updateTempPreset, persistTempPreset]
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
      render: (_, preset: Preset, index) => {
        const remove = () => {
          if (preset.isTemp) {
            disableTempPreset();
          } else {
            removePreset(index);
          }
        };

        if (preset.isTemp) {
          // temporary preset requires no double confirming
          return (
            <Tooltip
              position="left"
              triggerProps={{ mouseEnterDelay: 1000 }}
              content="Delete Preset"
            >
              <Button
                shape="circle"
                type="primary"
                status="danger"
                icon={<IconDelete />}
                onClick={disableTempPreset}
              ></Button>
            </Tooltip>
          );
        } else {
          return (
            <Space>
              {/* Delete Button */}
              <Popconfirm
                focusLock
                title="Confirm"
                content="Click again to delete this preset"
                onOk={remove}
              >
                <Tooltip
                  position="left"
                  triggerProps={{ mouseEnterDelay: 1000 }}
                  content="Delete Preset"
                >
                  <Button
                    shape="circle"
                    type="primary"
                    status="danger"
                    icon={<IconDelete />}
                  ></Button>
                </Tooltip>
              </Popconfirm>

              {/* Copy Button */}
              <Tooltip
                position="left"
                triggerProps={{ mouseEnterDelay: 1000 }}
                content="Copy Preset"
              >
                <Button
                  shape="circle"
                  type="primary"
                  icon={<IconCopy />}
                  onClick={() => copyPreset(index)}
                ></Button>
              </Tooltip>
            </Space>
          );
        }
      },
    },
  ];
  const tableData = useMemo(
    () => (tempPreset ? [...presets, tempPreset] : presets),
    [presets, tempPreset]
  );

  /**
   * Rearrange item index on sort end
   */
  const onSortEnd = useCallback(
    ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
      if (oldIndex !== newIndex) {
        movePreset(newIndex, oldIndex);
      }
    },
    [movePreset]
  );
  /**
   * Draggable container element
   */
  const DraggableContainer = (props: { children: ReactNode[] }) => (
    <SortableWrapper
      useDragHandle
      onSortEnd={onSortEnd}
      helperContainer={() => document.querySelector(".draggable-table table tbody")!}
      updateBeforeSortStart={({ node }) => {
        const tds = node.querySelectorAll("td");
        tds.forEach((td) => {
          td.style.width = `${td.clientWidth}px`;
        });
      }}
      {...props}
    />
  );
  /**
   * Draggable handler anchor
   */
  const DragHandlerAnchor = (record: Preset) => {
    if (record.isTemp) {
      return <td></td>;
    } else {
      return (
        <td>
          <div className="arco-table-cell">
            <DragHandler />
          </div>
        </td>
      );
    }
  };
  /**
   * Draggable & Editable row
   */
  const DraggableEditableRow = ({ index, ...rest }: RowProps & { index: number }) => {
    const props = { ...rest, rowIndex: index };
    if (rest.record.isTemp) {
      return <EditableRow {...props}></EditableRow>;
    } else {
      return <SortableEditableItem index={index} {...props} />;
    }
  };

  return (
    <Space size="medium" direction="vertical">
      {/* Add Preset */}
      <Tooltip triggerProps={{ mouseEnterDelay: 1000 }} content="Add New Preset">
        <Button
          shape="circle"
          type="primary"
          icon={<IconPlus />}
          disabled={!!tempPreset}
          onClick={(e) => {
            e.stopPropagation(); // stop propagation to prevent form validation
            enableTempPreset();
          }}
        ></Button>
      </Tooltip>

      {/* Presets Table */}
      <Table
        stripe
        size="mini"
        rowKey="name"
        className="draggable-table"
        pagination={false}
        columns={tableCols}
        data={tableData}
        components={{
          header: {
            operations: () => [
              {
                node: <th />,
                width: 40,
              },
            ],
          },
          body: {
            operations: () => [
              {
                node: DragHandlerAnchor,
                width: 40,
              },
            ],
            tbody: DraggableContainer,
            row: DraggableEditableRow,
            cell: EditableCell,
          },
        }}
      ></Table>
    </Space>
  );
}
