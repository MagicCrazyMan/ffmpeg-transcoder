import { Table, TableColumnProps } from "@arco-design/web-react";
import { listen } from "@tauri-apps/api/event";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import ComplexTaskModifier from "../../components/task/ComplexTaskModifier";
import SimpleTasksModifier, {
  SimpleTasksModifierInstance,
} from "../../components/task/SimpleTasksModifier";
import { Task } from "../../libs/task";
import { useTaskStore } from "../../store/task";
import Details from "./Details";
import FilesList from "./FileList";
import GlobalOperations from "./GlobalOperations";
import RowOperations from "./RowOperations";
import Status from "./Status";
import { currentMonitor } from "@tauri-apps/api/window";
import { window } from "@tauri-apps/api";

const droppings: Record<
  string,
  {
    setupModal: (
      modal: HTMLElement,
      options: {
        simpleTasksInstance?: SimpleTasksModifierInstance;
        setSimpleTasksModifierVisible: Dispatch<SetStateAction<boolean>>;
        setComplexTaskModifierVisible: Dispatch<SetStateAction<boolean>>;
      }
    ) => void;
  }
> = {
  SimpleTasksModifier: {
    setupModal(modal, { setSimpleTasksModifierVisible, simpleTasksInstance }) {
      modal.style.borderRadius = "100%";
      modal.addEventListener("drop", (e) => {
        const droppedFiles = e.dataTransfer?.files;
        if (!droppedFiles) return;

        console.log(droppedFiles);
        const files = [];
        for (let i = 0; i < droppedFiles.length; i++) {
          const file = droppedFiles.item(i);
          console.log(file?.webkitRelativePath);

          files.push(droppedFiles.item(i));
        }

        // simpleTasksInstance?.addTasksFromInputFiles();
        // setSimpleTasksModifierVisible(true);
      });
    },
  },
  ComplexTasksModifier: {
    setupModal(modal) {
      modal.style.borderRadius = "100%";
      modal.addEventListener("drop", (e) => {});
    },
  },
  DroppableTasksTable: {
    setupModal(modal) {
      modal.innerText = "ADD TASKS";
      modal.style.borderRadius = "6px";
      modal.style.color = "rgb(var(--green-5))";
      modal.style.fontSize = "24px";
      modal.style.fontWeight = "bold";
      modal.style.display = "flex";
      modal.style.justifyContent = "center";
      modal.style.alignItems = "center";
      modal.addEventListener("drop", (e) => {});
    },
  },
};

const createDroppingModal = (
  target: HTMLElement,
  modals: Map<HTMLElement, HTMLDivElement>,
  options: {
    simpleTasksInstance?: SimpleTasksModifierInstance;
    setSimpleTasksModifierVisible: Dispatch<SetStateAction<boolean>>;
    setComplexTaskModifierVisible: Dispatch<SetStateAction<boolean>>;
  }
) => {
  let modal = modals.get(target);
  if (modal) return;

  const { width, height, top, left } = target.getBoundingClientRect();
  modal = document.createElement("div");
  modal.style.position = "absolute";
  modal.style.zIndex = "1000";
  modal.style.border = "2px solid rgb(var(--green-5))";
  modal.style.backgroundColor = "rgba(var(--green-5), 0.4)";
  modal.style.width = `${width}px`;
  modal.style.height = `${height}px`;
  modal.style.top = `${top}px`;
  modal.style.left = `${left}px`;

  modal.addEventListener("dragleave", (e) => {
    e.preventDefault();
    modal!.remove();
    modals.delete(target);
  });
  modal.addEventListener("drop", (e) => {
    e.preventDefault();
    modal!.remove();
    modals.delete(target);
  });

  droppings[target.id]!.setupModal(modal, options);

  modals.set(target, modal);
  document.body.appendChild(modal);
};

/**
 * Page managing tasks queue.
 */
export default function QueuePage() {
  const tasks = useTaskStore((state) => state.tasks);

  const [simpleTasksAddingVisible, setSimpleTasksModifierVisible] = useState(false);
  const [complexTaskModifierVisible, setComplexTaskModifierVisible] = useState(false);

  const [modifyingTask, setModifyingTask] = useState<Task | undefined>(undefined);
  const onModify = (task: Task) => {
    setModifyingTask(task);
    setComplexTaskModifierVisible(true);
  };

  const simpleTasksInstance = useRef<SimpleTasksModifierInstance>();

  /**
   * Registers for dragging & dropping files
   */
  // useEffect(() => {
  //   const droppable = [
  //     document.getElementById("DroppableTasksTable")!,
  //     document.getElementById("SimpleTasksModifier")!,
  //     document.getElementById("ComplexTasksModifier")!,
  //   ];
  //   const modals = new Map<HTMLElement, HTMLDivElement>();

  //   const onDroppableDragEnter = (e: DragEvent) => {
  //     createDroppingModal(e.currentTarget as HTMLElement, modals, {
  //       simpleTasksInstance: simpleTasksInstance.current,
  //       setSimpleTasksModifierVisible,
  //       setComplexTaskModifierVisible,
  //     });
  //   };
  //   droppable.forEach((ele) => {
  //     ele.addEventListener("dragenter", onDroppableDragEnter);
  //   });

  //   return () => {
  //     modals.forEach((modal) => {
  //       modal.remove();
  //     });
  //     droppable.forEach((ele) => {
  //       ele.removeEventListener("dragenter", onDroppableDragEnter);
  //     });
  //   };
  // }, []);
  useEffect(() => {
    const unlisten = listen<{ paths: string[]; position: { x: number; y: number } }>(
      "tauri://file-drop-hover",
      (e) => {
        console.log(e.payload);

        const { x, y } = e.payload.position;
        const elements = document.elementsFromPoint(x, y)
        console.log(elements);
      }
    );

    return () => {
      unlisten.then((unlisten) => unlisten());
    };
  }, []);

  const tableCols: TableColumnProps<Task>[] = [
    {
      title: "Status",
      width: "64px",
      align: "center",
      bodyCellStyle: {
        lineHeight: "1",
      },
      render: (_, task) => <Status task={task} />,
    },
    {
      title: "Inputs",
      render: (_, task) => <FilesList type="input" task={task} />,
    },
    {
      title: "Outputs",
      render: (_, task) => <FilesList type="output" task={task} />,
    },
    {
      title: "Details",
      width: "20%",
      ellipsis: true,
      bodyCellStyle: {
        lineHeight: "1",
      },
      render: (_, task) => <Details task={task} />,
    },
    {
      title: "Operations",
      fixed: "right",
      width: "14rem",
      align: "center",
      render: (_, task) => <RowOperations task={task} onModify={onModify} />,
    },
  ];

  return (
    <div className="p-4 flex flex-col gap-4">
      <GlobalOperations
        setComplexTaskModifierVisible={setComplexTaskModifierVisible}
        setSimpleTasksModifierVisible={setSimpleTasksModifierVisible}
      />

      {/* Tasks Table */}
      <div id="DroppableTasksTable">
        <Table
          stripe
          pagination={false}
          size="mini"
          rowKey="id"
          columns={tableCols}
          data={tasks}
          rowClassName={() => "h-12"}
          scroll={{ x: "1200px", y: "calc(100vh - 112px)" }}
        />
      </div>

      {/* Simple Tasks Adding Dialog */}
      <SimpleTasksModifier
        ref={simpleTasksInstance}
        visible={simpleTasksAddingVisible}
        onVisibleChange={(visible) => {
          setSimpleTasksModifierVisible(visible);
        }}
      ></SimpleTasksModifier>

      {/* Complex Task Modifier Dialog */}
      <ComplexTaskModifier
        task={modifyingTask}
        visible={complexTaskModifierVisible}
        onVisibleChange={(visible) => {
          setComplexTaskModifierVisible(visible);
          setModifyingTask(undefined);
        }}
      ></ComplexTaskModifier>
    </div>
  );
}
