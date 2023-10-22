import { Form, FormInstance } from "@arco-design/web-react";
import { createContext, useRef } from "react";
import { PresetInTable, RowProps } from ".";

export const EditableContext = createContext<{
  getForm: () => FormInstance<Partial<PresetInTable>> | null;
} | null>(null);

/**
 * Editable Row Component
 */
export default function EditableRow({ children, record, className, ...rest }: RowProps) {
  const refForm = useRef<FormInstance<Partial<PresetInTable>>>(null);
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
}
