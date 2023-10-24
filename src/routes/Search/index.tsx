import { Button } from "@arco-design/web-react";
import { sep } from "@tauri-apps/api/path";
import { useNavigate } from "react-router-dom";
import { TaskArgs } from "../../libs/task";
import { toTaskArgs } from "../../libs/task/modifying";
import { useSearchStore } from "../../store/search";
import { useTaskStore } from "../../store/task";
import Directories from "./Directories";
import ExtensionFilter from "./ExtensionFilter";
import RegularFilters from "./RegularFilters";
import SearchFileTable from "./SearchFileTable";
import "./index.less";

/**
 * A page for searching files from a input directory
 * and adding multiple task from them
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const { outputDir, nodeMap, inputArgsMap, outputArgsMap, selectedRowKeys, setSelectedRowKeys } =
    useSearchStore();
  const { addTasks } = useTaskStore();

  const onAddTasks = () => {
    const tasArgs = selectedRowKeys.reduce((taskArgs, key) => {
      const fileNode = nodeMap.get(key);
      if (!fileNode || fileNode.type !== "File") return taskArgs;

      const inputArgs = inputArgsMap.get(fileNode.inputId);
      if (!inputArgs) return taskArgs;
      const outputArgs = outputArgsMap.get(fileNode.outputId);
      if (!outputArgs) return taskArgs;

      taskArgs.push({
        inputs: [
          toTaskArgs({
            ...inputArgs,
            path: fileNode.absolute,
          }),
        ],
        outputs: [
          toTaskArgs({
            ...outputArgs,
            path: [
              outputDir,
              ...fileNode.relative,
              `${fileNode.stem ?? ""}${fileNode.extension ? `.${fileNode.extension}` : ""}`,
            ].join(sep),
          }),
        ],
      });

      return taskArgs;
    }, [] as TaskArgs[]);

    addTasks(...tasArgs);
    setSelectedRowKeys([]);
    navigate("/tasks");
  };

  return (
    <div className="container p-4 box-border h-screen flex basis-full flex-col">
      {/* Input & Output Directories Selector */}
      <Directories />

      <div className="flex-1 overflow-hidden flex">
        <div className="mr-4 basis-72 flex-shrink-0 flex flex-col">
          {/* Extensions Filter */}
          <ExtensionFilter />

          {/* Regular Filters */}
          <div className="flex-1 overflow-y-hidden">
            <RegularFilters />
          </div>

          {/* Submit */}
          <Button
            type="primary"
            className="submit"
            disabled={selectedRowKeys.length === 0}
            onClick={onAddTasks}
          >
            Add Tasks
          </Button>
        </div>

        {/* Files Table */}
        <div className="flex-1 overflow-hidden">
          <SearchFileTable />
        </div>
      </div>
    </div>
  );
}
