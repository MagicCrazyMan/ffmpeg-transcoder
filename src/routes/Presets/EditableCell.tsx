import { Form, Input, RulesProps, Select, Space, Tag } from "@arco-design/web-react";
import { ColumnProps } from "@arco-design/web-react/es/Table";
import { ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PresetInTable } from ".";
import { PresetType } from "../../libs/preset";
import { EditableContext } from "./EditableRow";

export type CellProps = {
  rowData: PresetInTable;
  className: string;
  column: ColumnProps<PresetInTable>;
  children: PresetInTable[keyof PresetInTable];
  onHandleSave: (row: PresetInTable) => void;
};

const NormalCell = ({ children, className }: CellProps) => (
  <div className={className}>{children}</div>
);

/**
 * Name field and its editing cell
 */
const NameCell = ({ preset }: { preset: PresetInTable }) => (
  <div className="inline-block">{preset.name}</div>
);
const EditingNameRules: RulesProps[] = [{ required: true }];
const EditingNameCell = ({ submit }: { submit: () => void }) => {
  return (
    <Form.Item
      field="name"
      style={{ marginBottom: 0 }}
      labelCol={{ span: 0 }}
      wrapperCol={{ span: 24 }}
      rules={EditingNameRules}
    >
      <Input autoFocus onPressEnter={submit} />
    </Form.Item>
  );
};

/**
 * Remark field and its editing cell
 */
const RemarkCell = ({ preset }: { preset: PresetInTable }) => (
  <div className="inline-block">{preset.remark ?? ""}</div>
);
const EditingRemarkCell = ({ submit }: { submit: () => void }) => {
  return (
    <Form.Item
      field="remark"
      style={{ marginBottom: 0 }}
      labelCol={{ span: 0 }}
      wrapperCol={{ span: 24 }}
    >
      <Input.TextArea autoFocus autoSize onPressEnter={submit} />
    </Form.Item>
  );
};

/**
 * Type field and its editing cell
 */
const TypeCell = ({ preset }: { preset: PresetInTable }) => {
  switch (preset.type) {
    case PresetType.Universal:
      return "Universal";
    case PresetType.Decode:
      return "For Decode Only";
    case PresetType.Encode:
      return "For Encode Only";
  }
};
const EditingTypeCell = () => {
  return (
    <Form.Item
      field="type"
      style={{ marginBottom: 0 }}
      labelCol={{ span: 0 }}
      wrapperCol={{ span: 24 }}
    >
      <Select>
        <Select.Option value={PresetType.Universal}>Universal</Select.Option>
        <Select.Option value={PresetType.Decode}>For Decode Only</Select.Option>
        <Select.Option value={PresetType.Encode}>For Encode Only</Select.Option>
      </Select>
    </Form.Item>
  );
};

/**
 * Arguments field and its editing cell
 */
const ArgumentsCell = ({ preset }: { preset: PresetInTable }) => {
  const tags = preset.args.map((param, index) => <Tag key={`${param}_${index}`}>{param}</Tag>);
  return (
    <Space wrap size="mini">
      {tags}
    </Space>
  );
};
const EditingArgumentsCell = ({ submit, preset }: { submit: () => void; preset: PresetInTable }) => {
  return (
    <Form.Item
      field="args"
      formatter={(value: string | undefined) =>
        (value as unknown as string[] | undefined)?.join(" ")
      }
      normalize={(value: string | undefined) => value?.split(" ").map((param) => param.trim())}
      style={{ marginBottom: 0 }}
      labelCol={{ span: 0 }}
      wrapperCol={{ span: 24 }}
    >
      <Input.TextArea allowClear autoSize autoFocus={!preset.id} onPressEnter={submit} />
    </Form.Item>
  );
};

/**
 * Extension field and its editing cell
 */
const ExtensionCell = ({ preset }: { preset: PresetInTable }) => (
  <div className="inline-block">{preset.extension ?? ""}</div>
);
const EditingExtensionCell = ({
  submit,
  preset,
}: {
  submit: () => void;
  preset: PresetInTable;
}) => {
  if (preset.type === PresetType.Encode || preset.type === PresetType.Universal) {
    return (
      <Form.Item
        field="extension"
        style={{ marginBottom: 0 }}
        labelCol={{ span: 0 }}
        wrapperCol={{ span: 24 }}
      >
        <Input autoFocus onPressEnter={submit} />
      </Form.Item>
    );
  }
};

/**
 * Editable Cell Component
 */
export default function EditableCell(props: CellProps) {
  const { rowData, column, onHandleSave } = props;

  const { getForm } = useContext(EditableContext)!;

  const cellRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(!rowData.id); // always in editing mode when is adding preset

  /**
   * Submits and saves data
   */
  const submit = useCallback(() => {
    getForm?.()
      ?.validate()
      .then((partial) => {
        if (onHandleSave) {
          onHandleSave({
            ...rowData,
            ...partial,
            // remove all empty values
            args: partial.args ? partial.args.filter((param) => !!param) : rowData.args,
          });
        }

        setEditing(false);
      });
  }, [getForm, onHandleSave, rowData]);

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
      const arcoSelectClassList = ["arco-select-popup", "arco-select-option"];
      if (
        e.target &&
        Array.from<string>((e.target as HTMLElement).classList.values()).some((className) =>
          arcoSelectClassList.includes(className)
        )
      )
        return;

      submit();
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [column, submit, editing]);

  // returns normal cell for uneditable field
  if (!column.editable) return <NormalCell {...props} />;

  // returns editing or normal cell for editable field
  if (editing) {
    let cell: ReactNode;
    switch (column.dataIndex) {
      case "name":
        cell = <EditingNameCell submit={submit} />;
        break;
      case "type":
        cell = <EditingTypeCell />;
        break;
      case "args":
        cell = <EditingArgumentsCell submit={submit} preset={rowData} />;
        break;
      case "extension":
        cell = <EditingExtensionCell submit={submit} preset={rowData} />;
        break;
      case "remark":
        cell = <EditingRemarkCell submit={submit} />;
        break;
    }

    return <div ref={cellRef}>{cell}</div>;
  } else {
    let cell: ReactNode;
    switch (column.dataIndex) {
      case "name":
        cell = <NameCell preset={rowData} />;
        break;
      case "type":
        cell = <TypeCell preset={rowData} />;
        break;
      case "args":
        cell = <ArgumentsCell preset={rowData} />;
        break;
      case "extension":
        cell = <ExtensionCell preset={rowData} />;
        break;
      case "remark":
        cell = <RemarkCell preset={rowData} />;
        break;
    }

    return (
      <div className="w-full h-full" onClick={() => setEditing(true)}>
        {cell}
      </div>
    );
  }
}
