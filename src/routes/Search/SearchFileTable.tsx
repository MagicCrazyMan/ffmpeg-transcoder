import { Button, Switch, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDown, IconRight, IconSettings } from "@arco-design/web-react/icon";
import { sep } from "@tauri-apps/api/path";
import { ReactNode, useMemo, useState } from "react";
import { ExtensionFilterState, useSearchStore } from "../../store/search";
import { SearchDirectory, SearchFile } from "../../tauri/fs";
import ParamsModifier from "../../components/task/ParamsModifier";

type FilteredSearchEntry = FilteredSearchDirectory | FilteredSearchFile;

type FilteredSearchDirectory = {
  type: "Directory";
  name: string;
  absolute: string;
  relative: string;
  children: FilteredSearchEntry[];
  path: string;
  parent: FilteredSearchDirectory | null;
};

type FilteredSearchFile = SearchFile & {
  parent: FilteredSearchDirectory;
};

export default function SearchFileTable() {
  const { inputDir, outputDir, searchDirectory, isFileLoading, extensionFilters, regularFilters } =
    useSearchStore();

  const [pathDisplayStyle, setPathDisplayStyle] = useState(false);

  const tableCols: TableColumnProps<FilteredSearchEntry>[] = [
    {
      title: "Input Files",
      width: "30%",
      render(_col, item) {
        if (pathDisplayStyle) {
          return item.relative;
        } else {
          return (inputDir!.endsWith(sep) ? inputDir!.slice(0, -1) : inputDir!) + item.relative;
        }
      },
    },
    {
      title: "Input Params",
      width: "20%",
      render(col, item, index) {
        return <ParamsModifier />;
      },
    },
    {
      title: "Output Files",
      width: "30%",
      render(_col, item) {
        if (item.type !== "File") return;
        if (!selectedRowKeysSet.has(item.absolute)) return;
        if (!outputDir) return "NULL";

        if (pathDisplayStyle) {
          return item.relative;
        } else {
          return (outputDir.endsWith(sep) ? outputDir.slice(0, -1) : outputDir) + item.relative;
        }
      },
    },
    {
      title: "Output Params",
      width: "20%",
    },
  ];

  const components = {
    header: {
      operations: ({
        selectionNode,
        expandNode,
      }: {
        selectionNode?: ReactNode;
        expandNode?: ReactNode;
      }) => [
        {
          name: "selectionNode",
          node: selectionNode,
        },
        {
          name: "expandNode",
          node: expandNode,
        },
        {
          node: (
            <th>
              <div className="arco-table-th-item"></div>
            </th>
          ),
          width: 32,
        },
      ],
    },
    body: {
      operations: ({
        selectionNode,
        expandNode,
      }: {
        selectionNode?: ReactNode;
        expandNode?: ReactNode;
      }) => [
        {
          name: "selectionNode",
          node: selectionNode,
        },
        {
          name: "expandNode",
          node: expandNode,
        },
        {
          node: (item: FilteredSearchEntry) => {
            if (item.type === "File" && selectedRowKeysSet.has(item.absolute)) {
              return (
                <td>
                  <Button size="mini" shape="circle" icon={<IconSettings />} />
                </td>
              );
            } else {
              return <td></td>;
            }
          },
          width: 32,
        },
      ],
    },
  };

  const [expendedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const root = useMemo(() => {
    if (!searchDirectory) return;

    const expendedRowKeys: string[] = [];
    const clonedRoot: FilteredSearchDirectory = { ...searchDirectory, children: [], parent: null };

    const directories: [SearchDirectory, FilteredSearchDirectory][] = [
      [searchDirectory, clonedRoot],
    ];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const item = directories.pop();
      if (!item) break;

      const [directory, cloned] = item;

      directory.children.forEach((child) => {
        // apply filters
        let shouldDrop = false;
        {
          // apply regular filters
          if (regularFilters.enabled) {
            for (const regularFilter of regularFilters.filters) {
              if (shouldDrop) break;
              if (!regularFilter.value) continue;
              if (!regularFilter.enabled) continue;
              if (!regularFilter.file && child.type === "File") continue;
              if (!regularFilter.directory && child.type === "Directory") continue;

              let included: boolean;
              if (regularFilter.regex) {
                try {
                  included = new RegExp(regularFilter.value).test(child.name);
                } catch (err) {
                  console.error(err);
                  continue;
                }
              } else {
                included = child.name.includes(regularFilter.value);
              }
              shouldDrop = regularFilter.blacklist ? included : !included;
            }
          }

          // apply extension filters for files
          if (!shouldDrop && child.type === "File") {
            if (child.extension) {
              // for file having extension, filter them
              const included = extensionFilters.extensions.includes(child.extension);
              if (extensionFilters.state === ExtensionFilterState.Whitelist) {
                shouldDrop = !included;
              } else if (extensionFilters.state === ExtensionFilterState.Blacklist) {
                shouldDrop = included;
              }
            } else {
              // if file has no extension, drop only when extension filters enabled
              if (extensionFilters.state !== ExtensionFilterState.Disabled) {
                shouldDrop = true;
              }
            }
          }
        }

        if (shouldDrop) return;

        if (child.type === "Directory") {
          const clonedChild = { ...child, children: [], parent: cloned };
          expendedRowKeys.push(child.absolute);
          directories.push([child, clonedChild]);

          cloned.children.push(clonedChild);
        } else {
          cloned.children.push({
            ...child,
            parent: cloned,
          });
        }
      });

      // if directory empty, clean upper directories
      {
        if (cloned.children.length === 0) {
          if (cloned.parent) {
            // recursively clean empty directories from current node to upper nodes
            let node: FilteredSearchDirectory = cloned;
            while (node.parent) {
              node.parent.children = node.parent.children.filter((child) => child !== node);

              if (node.parent.children.length === 0) {
                node = node.parent;
              } else {
                break;
              }
            }
          } else {
            // reach root node, if root node has no children, remove undefined directly
            return;
          }
        }
      }
    }

    setExpandedRowKeys(expendedRowKeys);
    return clonedRoot;
  }, [searchDirectory, extensionFilters, regularFilters, setExpandedRowKeys]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const selectedRowKeysSet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);

  return (
    <div>
      <Switch
        className="mb-2"
        checkedText="RELATIVE"
        uncheckedText="ABSOLUTE"
        checked={pathDisplayStyle}
        onChange={setPathDisplayStyle}
      />

      <Table
        stripe
        size="mini"
        rowKey="absolute"
        pagination={false}
        loading={isFileLoading}
        columns={tableCols}
        expandedRowKeys={expendedRowKeys}
        onExpandedRowsChange={(value) => setExpandedRowKeys(value as string[])}
        expandProps={{
          icon: ({ expanded, ...restProps }) =>
            expanded ? (
              <button {...restProps}>
                <IconDown />
              </button>
            ) : (
              <button {...restProps}>
                <IconRight />
              </button>
            ),
        }}
        rowSelection={{
          type: "checkbox",
          columnWidth: 32,
          renderCell(originNode, _checked, record) {
            if (record.type === "File") {
              return originNode;
            } else {
              return undefined;
            }
          },
          selectedRowKeys,
          onChange(selectedRowKeys) {
            setSelectedRowKeys(selectedRowKeys as string[]);
          },
        }}
        data={root?.children}
      ></Table>
    </div>
  );
}
