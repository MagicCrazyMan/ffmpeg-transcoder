import { IconDragDotVertical } from "@arco-design/web-react/icon";
import { ReactNode } from "react";
import { SortableContainer, SortableElement, SortableHandle } from "react-sortable-hoc";
import { PresetInTable, RowProps } from ".";
import { usePresetStore } from "../../store/preset";
import EditableRow from "./EditableRow";

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
 * Rearrange item index on sort end
 */
const onSortEnd = ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
  if (oldIndex !== newIndex) {
    usePresetStore.getState().movePreset(oldIndex, newIndex);
  }
};

/**
 * Draggable container element
 */
export const DraggableContainer = (props: { children: ReactNode[] }) => (
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
 * Sortable element wrapped editable row component
 */
const SortableEditableRow = SortableElement((props: RowProps) => <EditableRow {...props} />);

/**
 * Draggable handler anchor
 */
export const DragHandlerAnchor = (preset: PresetInTable) => {
  if (preset.id) {
    return (
      <td>
        <div className="arco-table-cell">
          <DragHandler />
        </div>
      </td>
    );
  } else {
    return <td></td>;
  }
};
/**
 * Draggable & Editable row
 */
export const DraggableEditableRow = ({ index, ...rest }: RowProps & { index: number }) => {
  const props = { ...rest };
  if (rest.record.id) {
    return <SortableEditableRow index={index} {...props} />;
  } else {
    return <EditableRow {...props}></EditableRow>;
  }
};
