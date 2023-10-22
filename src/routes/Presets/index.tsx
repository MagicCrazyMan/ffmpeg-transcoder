import { Button, Table, TableColumnProps, Tooltip } from "@arco-design/web-react";
import { IconPlus } from "@arco-design/web-react/icon";
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { unstable_useBlocker } from "react-router-dom";
import { v4 } from "uuid";
import { Preset, PresetType } from "../../libs/preset";
import { usePresetStore } from "../../store/preset";
import DefaultCodec from "./DefaultCodec";
import EditableCell from "./EditableCell";
import Operations from "./Operations";
import { DragHandlerAnchor, DraggableContainer, DraggableEditableRow } from "./Sortable";

export type PresetInTable = Omit<Preset, "id" | "name"> & { id?: string; name?: string };

export type RowProps = {
  className: string;
  children: ReactNode[];
  record: PresetInTable;
};

export const PresetContext = createContext<{
  getAddingPreset: () => PresetInTable | undefined;
  setAddingPreset: Dispatch<SetStateAction<PresetInTable | undefined>>;
} | null>(null);

/**
 * A page managing user-defined decode and encode params presets.
 */
export default function PresetsPage() {
  const { storage, addPreset, updatePreset } = usePresetStore();

  const [addingPreset, setAddingPreset] = useState<PresetInTable | undefined>();

  /**
   * Block leaving page if temporary preset is editing
   */
  const isBlocking = useMemo(() => !!addingPreset, [addingPreset]);
  const blocker = unstable_useBlocker(isBlocking);
  useEffect(() => {
    if (blocker.state === "blocked" && !isBlocking) {
      blocker.reset();
    }
  }, [blocker, isBlocking]);

  /**
   * Save preset when cell value change
   */
  const onCell = useCallback(() => {
    return {
      onHandleSave: (preset: PresetInTable) => {
        if (preset.id) {
          updatePreset(preset.id, preset);
        } else {
          setAddingPreset(preset);
          // add to store when name typed
          if (preset.name) {
            addPreset({
              ...preset,
              id: v4(),
              name: preset.name,
            });
            setAddingPreset(undefined);
          }
        }
      },
    };
  }, [addPreset, updatePreset]);
  const tableCols: TableColumnProps<PresetInTable>[] = useMemo(
    () => [
      {
        title: "DD",
        width: "24px",
        align: "center",
        render: (_col, preset) => <DefaultCodec type={PresetType.Decode} preset={preset} />,
      },
      {
        title: "DE",
        width: "24px",
        align: "center",
        render: (_col, preset) => <DefaultCodec type={PresetType.Encode} preset={preset} />,
      },
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
        title: "Extension",
        dataIndex: "extension",
        width: "6rem",
        align: "center",
        editable: true,
        onCell,
      },
      {
        title: "Operations",
        width: "150px",
        align: "center",
        render: (_, preset) => <Operations preset={preset} />,
      },
    ],
    [onCell]
  );

  const tableData = useMemo(
    () => (addingPreset ? [...storage.presets, addingPreset] : storage.presets),
    [addingPreset, storage.presets]
  );

  return (
    <PresetContext.Provider
      value={{
        getAddingPreset: () => addingPreset,
        setAddingPreset,
      }}
    >
      <div className="p-4 flex flex-col gap-4">
        {/* Add Preset */}
        <Tooltip content="Add New Preset">
          <Button
            shape="circle"
            type="primary"
            icon={<IconPlus />}
            disabled={!!addingPreset}
            onClick={(e) => {
              e.stopPropagation(); // stop propagation to prevent form validation
              setAddingPreset({
                type: PresetType.Universal,
                params: [],
              });
            }}
          ></Button>
        </Tooltip>

        {/* Presets Table */}
        <Table
          stripe
          size="mini"
          rowKey="id"
          className="draggable-table"
          scroll={{ x: "1200px", y: "calc(100vh - 112px)" }}
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
      </div>
    </PresetContext.Provider>
  );
}
