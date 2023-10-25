import { Button } from "@arco-design/web-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TaskArgs } from "../../libs/task";
import { toTaskArgs } from "../../libs/task/modifying";
import { useSearchStore } from "../../store/search";
import { useTaskStore } from "../../store/task";
import Directories from "./Directories";
import ExtensionFilter from "./ExtensionFilter";
import RegularFilters from "./RegularFilters";
import SearchTable from "./SearchTable";
import "./index.less";

/**
 * A page for searching files from a input directory
 * and adding multiple task from them
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const { inputArgsMap, outputArgsMap, selectedRows, setSelectedRows } = useSearchStore();
  const { addTasks } = useTaskStore();

  const addable = useMemo(() => {
    if (selectedRows.length === 0) return false;

    const pathsSet = selectedRows.reduce((paths, node) => {
      const outputArgs = outputArgsMap.get(node.outputId);
      if (!outputArgs || !outputArgs.path) return paths;

      paths.add(outputArgs.path)
      return paths;
    }, new Set());

    return pathsSet.size === selectedRows.length;
  }, [outputArgsMap, selectedRows]);

  /**
   * Add Tasks
   */
  const onAddTasks = () => {
    const taskArgs = selectedRows.reduce((taskArgs, node) => {
      const inputArgs = inputArgsMap.get(node.inputId);
      if (!inputArgs) return taskArgs;
      const outputArgs = outputArgsMap.get(node.outputId);
      if (!outputArgs) return taskArgs;

      taskArgs.push({
        inputs: [toTaskArgs(inputArgs)],
        outputs: [toTaskArgs(outputArgs)],
      });

      return taskArgs;
    }, [] as TaskArgs[]);

    addTasks(...taskArgs);
    setSelectedRows([]);
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
          <Button type="primary" className="submit" disabled={!addable} onClick={onAddTasks}>
            Add Tasks
          </Button>
        </div>

        {/* Files Table */}
        <div className="flex-1 overflow-hidden">
          <SearchTable />
        </div>
      </div>
    </div>
  );
}
