import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  updateEdge,
  useReactFlow,
  getRectOfNodes,
  getTransformForBounds,
  MarkerType,
  getBezierPath,
  Panel
} from "reactflow";

import CircleNode from "./node/Node";
import RightsidePanel from "./RightsidePanel";
import NodeProperties from "./node/NodeRightClick";
import Nodecard from "./node/Nodecard";
import RectangularNode from "./node/RectangularNode";

import { v4 as uuidv4 } from "uuid";
import { toPng } from "html-to-image";
import { motion } from "framer-motion";

import api from "./utility/BaseAPI";
import { useGlobalContext } from "./utility/SidebarSlide";
import { showError, showSuccess } from "./utility/ToastNotofication";

import "reactflow/dist/style.css";
import 'react-quill/dist/quill.snow.css';

const imageWidth = 1024;
const imageHeight = 768;
const nodeTypes = {
  circle: CircleNode,
  card: RectangularNode
};

function downloadImage(dataUrl) {
  const a = document.createElement("a");
  a.setAttribute("download", "flowchart.png");
  a.setAttribute("href", dataUrl);
  a.click();
}

const Content = ({ selectedProjectId }) => {
  const { getNodes } = useReactFlow();
  const ref = useRef(null);
  
  // States
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [id, setId] = useState(0);
  const [projectMembers, setProjectMembers] = useState([]);
  const { isSidebarOpen, closeSidebar } = useGlobalContext();
  const [selectedNode, setSelectedNode] = useState(null);
  const [newNodeInput, setNewNodeInput] = useState({
    id: "",
    task: "",
    assignedTo: "",
    deadline: new Date(),
    color: "#ffffff",
  });
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [nodeId, setNodeId] = useState();
  const [nodeName, setNodeName] = useState();
  const [nodeDescription, setNodeDescription] = useState("");
  const [description, setDescription] = useState('');
  const [nodeColor, setNodeColor] = useState("#ffffff");
  const [isCompleted, setIsCompleted] = useState(false);
  const [status, setStatus] = useState("");
  const [stuckReason, setStuckReason] = useState('');
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const edgeUpdateSuccessful = useRef(true);
  const [showModal, setShowModal] = useState(false);
  const [menu, setMenu] = useState(null);
  const [todos, setTodos] = useState([]);

  // Fetch project members when project changes
  useEffect(() => {
    const fetchProjectMembers = async () => {
      if (!selectedProjectId) return;
      try {
        const res = await api.get(`/projects/${selectedProjectId}/members`);
        setProjectMembers(res.data);
      } catch (err) {
        console.error("Failed to fetch project members:", err);
      }
    };
    fetchProjectMembers();
  }, [selectedProjectId]);

  // Load graph data when project changes
  useEffect(() => {
    const fetchGraphData = async () => {
      if (!selectedProjectId) return;
      try {
        const res = await api.get(`/load/${selectedProjectId}`);
        const backendNodes = res.data.nodes.map((node) => ({
          id: node.graphNodeId.toString(),
          position: { x: node.posX, y: node.posY },
          type: node.type || "card",
          data: {
            projectId: node.projectId,
            task: node.task,
            assignedTo: node.assignedTo,
            assignedBy: node.assignedBy,
            creatorId: node.creatorId,
            createdTime: node.createdTime,
            deadline: node.deadline,
            status: node.status,
            stuckReason: node.stuckReason,
            description: node.description,
          },
        }));

        const backendEdges = res.data.edges.map((edge) => ({
          id: edge.graphEdgeId?.toString() || `e${edge.source}-${edge.target}`,
          source: edge.source.toString(),
          target: edge.target.toString(),
        }));

        setNodes(enhanceNodesWithStatusHandler(backendNodes));
        setEdges(backendEdges);
      } catch (err) {
        console.error("❌ Failed to fetch graph data", err);
      }
    };
    fetchGraphData();
  }, [selectedProjectId, setNodes, setEdges]);

  // ReactFlow utility functions
  const getId = useCallback(() => {
    setId((prevId) => prevId + 1);
    return `node_${id}`;
  }, [id]);

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      const pane = ref.current.getBoundingClientRect();
      setMenu({
        id: node.id,
        top: event.clientY < pane.height - 200 && event.clientY - 60,
        left: event.clientX < pane.width - 200 && (isSidebarOpen ? event.clientX - 300 : event.clientX),
        right: event.clientX >= pane.width - 200 && pane.width - (isSidebarOpen ? event.clientX - 300 : event.clientX),
        bottom: event.clientY >= pane.height - 200 && pane.height - event.clientY + 70,
      });
    },
    [setMenu, isSidebarOpen]
  );

  const onEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      edgeUpdateSuccessful.current = true;
      setEdges((els) => updateEdge(oldEdge, newConnection, els));
    },
    [setEdges]
  );

  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false;
  }, []);

  const onEdgeUpdateEnd = useCallback(
    (_, edge) => {
      if (!edgeUpdateSuccessful.current) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
      edgeUpdateSuccessful.current = true;
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (typeof type === "undefined" || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
        style: {
          background: "#ffffff",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          transition: "all 0.3s ease",
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, getId, setNodes]
  );

  const handleDownload = () => {
    const nodesBounds = getRectOfNodes(getNodes());
    const transform = getTransformForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      0.5,
      2
    );

    toPng(document.querySelector(".react-flow__viewport"), {
      backgroundColor: "#f8fafc", // Light gray background
      width: imageWidth,
      height: imageHeight,
      style: {
        width: imageWidth,
        height: imageHeight,
        transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
      },
    }).then(downloadImage);
  };

  // Close the context menu when clicking elsewhere
  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

  // Create a new node
  const handleCreateNode = async () => {
    const task = newNodeInput.task.trim();
    if (task === "") {
      showError("Task is mandatory");
      return;
    }
    if (!newNodeInput.assignedTo) {
      showError("Please select a member before creating the node.");
      return;
    }
    if (new Date(newNodeInput.deadline) < new Date()) {
      showError("Your deadline has passed before creation, please select new deadline");
      return;
    }

    const memberId = localStorage.getItem("memberId");
    const assignedBy = localStorage.getItem("username");

    const newNode = {
      id: uuidv4(),
      position: { x: 100, y: 100 },
      type: "card",
      data: {
        projectId: selectedProjectId,
        task: newNodeInput.task,
        assignedTo: newNodeInput.assignedTo,
        creatorId: memberId,
        assignedBy: assignedBy,
        createdTime: new Date().toISOString(),
        deadline: newNodeInput.deadline || new Date().toISOString(),
        status: "unpicked",
        description: description,
        stuckReason: '',
        onStatusChange: (newStatus) => {
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              n.id === newNode.id
                ? { ...n, data: { ...n.data, status: newStatus } }
                : n
            )
          );
        },
      },
    };
    
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    setNewNodeInput({ 
      id: "", 
      assignedTo: "", 
      task: "", 
      deadline: new Date().toISOString(), 
      name: "", 
      color: "#ffffff" 
    });
    
    await api.post(`/mail`, {
      node: newNode
    });
    await saveGraphNoAlert(updatedNodes, edges);
    showSuccess('Node created successfully');
  };

  // Save graph data to backend without alert
  const saveGraphNoAlert = async (nodesArg, edgesArg) => {
    const formattedNodes = nodesArg.map((node) => ({
      graphNodeId: node.id,
      projectId: node.data.projectId,
      task: node.data.task,
      assignedTo: node.data.assignedTo,
      creatorId: node.data.creatorId,
      assignedBy: node.data.assignedBy,
      createdTime: node.data.createdTime,
      assignedAt: new Date().toISOString(),
      deadline: node.data.deadline,
      status: node.data.status,
      stuckReason: node.data.stuckReason || '',
      description: node.data.description || '',
      posX: node.position.x,
      posY: node.position.y,
    }));
    
    const formattedEdges = edgesArg.map((edge) => ({
      graphEdgeId: edge.id,
      projectId: selectedProjectId,
      source: edge.source,
      target: edge.target,
    }));

    await api.post(`/save`, {
      nodes: formattedNodes,
      edges: formattedEdges,
    });

    setDescription("");
  };

  // Save graph with success notification
  const saveGraph = async () => {
    await saveGraphNoAlert(nodes, edges);
    showSuccess("Graph saved successfully!");
  };

  // Filter nodes by project ID
  const filteredNodes = useMemo(() => {
    return nodes.filter(
      (node) => `${node.data.projectId}` === `${selectedProjectId}`
    );
  }, [nodes, selectedProjectId]);

  // Add status change handler to nodes
  const enhanceNodesWithStatusHandler = (nodes) => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onStatusChange: (newStatus) => {
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              n.id === node.id
                ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: newStatus,
                  },
                }
                : n
            )
          );
        },
      },
    }));
  };

  // Handle node click
  const onNodeClick = useCallback(async (event, node) => {
    setSelectedNode(node);
    setNodeName(node.data.task);
    setNodeId(node.id);
    setNodeColor("transparent");
    setStatus(node.data.status || "");
    setStuckReason(node.data.stuckReason || "");

    try {
      const res = await api.get(`/nodes/${node.id}/todos`);
      setTodos(res.data);
      setNodeDescription(node.data.description || "");
      setIsCompleted(node.data.status === "completed");
      setShowModal(true);
    } catch (error) {
      console.error("Failed to fetch todos", error);
    }
  }, []);

  // Toggle todo completion status
  const onToggleTodo = async (todoId) => {
    await api.post(`/todos/${todoId}/toggle`);
    const res = await api.get(`/nodes/${nodeId}/todos`);
    setTodos(res.data);
  };

  // Mark node as completed
  const onMarkCompleted = async () => {
    try {
      await api.post(`/nodes/${nodeId}/complete`);
      setIsCompleted(true);
      setNodeColor("green");
      setShowModal(false);
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, status: "completed" } }
            : node
        )
      );
      showSuccess("Node marked as completed successfully!");
    } catch (error) {
      if (error.response && error.response.data) {
        showError(
          error.response.data.message ||
          "All todos must be completed before marking as completed."
        );
      } else {
        showError("Something went wrong. Please try again.");
      }
    }
  };

  // Add a new todo to node
  const onAddTodo = async (newTask) => {
    const localMemberId = localStorage.getItem("memberId");
    await api.post(`/nodes/${nodeId}/todos`, {
      task: newTask,
      memberId: localMemberId,
    });
    const res = await api.get(`/nodes/${nodeId}/todos`);
    setTodos(res.data);
    showSuccess("Added new todo");
  };

  // Change node status
  const onStatusChange = (newStatus) => {
    if (!nodeId) return;

    const currentUsername = localStorage.getItem("username");
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      showError("Node not found.");
      return;
    }

    if (node.data.assignedTo !== currentUsername) {
      showError("You are not assigned to this node and cannot update its status.");
      return;
    }

    const colorMap = {
      pending: "#3b82f6",
      stuck: "#facc15",
      completed: "#10b981",
    };

    setNodeColor(colorMap[newStatus] || "#ffffff");
    setStatus(newStatus);

    // Clear stuck reason if status is not stuck
    if (newStatus !== "stuck") {
      setStuckReason("");
    }

    setNodes((prevNodes) =>
      prevNodes.map((n) =>
        n.id === nodeId
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                status: newStatus,
                stuckReason: newStatus === "stuck" ? n.data.stuckReason : ""
              } 
            }
          : n
      )
    );
  };

  // Update stuck reason
  const onStuckReasonChange = async (reason) => {
    setStuckReason(reason);
    
    try {
      await api.post(`/nodes/${nodeId}/update-stuck-reason`, { stuckReason: reason });
      
      setNodes((prevNodes) =>
        prevNodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  stuckReason: reason,
                },
              }
            : n
        )
      );
      showSuccess("Updated stuck reason");
    } catch (err) {
      console.error("Error updating stuck reason:", err);
      showError("Failed to update reason");
    }
  };

  // Edge styling
  const edgeStyle = {
    type: 'bezier',
    animated: true,
    style: {
      stroke: '#64748b',
      strokeWidth: 2,
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
      strokeDasharray: '5 5',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#64748b',
      width: 20,
      height: 20,
    },
  };

  // Custom connection line
  const customEdgeLine = ({ fromX, fromY, toX, toY }) => {
    const [edgePath] = getBezierPath({
      sourceX: fromX,
      sourceY: fromY,
      targetX: toX,
      targetY: toY,
    });

    return (
      <path
        d={edgePath}
        stroke="#3b82f6"
        strokeWidth={2}
        fill="none"
        style={{ 
          strokeDasharray: '5 5',
          filter: 'drop-shadow(0 1px 2px rgba(59, 130, 246, 0.3))'
        }}
      />
    );
  };

  // Update node deadline
  const onDeadlineChange = async (newDeadline) => {
    try {
      await api.post(`/nodes/${nodeId}/update-deadline`, { deadline: newDeadline });
      setNodes((prevNodes) =>
        prevNodes.map((n) =>
          n.id === nodeId
            ? {
              ...n,
              data: {
                ...n.data,
                deadline: newDeadline,
              },
            }
            : n
        )
      );
    } catch (err) {
      console.error("Error updating deadline:", err);
      throw err;
    }
  };

  return (
    <ReactFlow
      ref={ref}
      nodes={filteredNodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onInit={setReactFlowInstance}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onEdgeUpdate={onEdgeUpdate}
      onEdgeUpdateStart={onEdgeUpdateStart}
      onEdgeUpdateEnd={onEdgeUpdateEnd}
      defaultEdgeOptions={edgeStyle}
      connectionLineComponent={customEdgeLine}
      onPaneClick={onPaneClick}
      onNodeContextMenu={onNodeContextMenu}
      nodeTypes={nodeTypes}
      proOptions={{ hideAttribution: true }}
      fitView
    >
      {/* Rightside panel */}
      <RightsidePanel
        isSidebarOpen={isSidebarOpen}
        closeSidebar={closeSidebar}
        projectMembers={projectMembers}
        newNodeInput={newNodeInput}
        setNewNodeInput={setNewNodeInput}
        description={description}
        setDescription={setDescription}
        handleCreateNode={handleCreateNode}
        saveGraph={saveGraph}
        onClick={handleDownload}
      />

      <Panel position="top-left" className="bg-white bg-opacity-80 p-2 rounded-lg shadow-md">
        <div className="text-sm font-semibold text-gray-700">
          {selectedProjectId ? `Project Flow - ID: ${selectedProjectId}` : 'No Project Selected'}
        </div>
      </Panel>

      <Controls className="bg-white bg-opacity-90 rounded-lg shadow-lg" />
      
      <MiniMap 
        zoomable 
        pannable 
        className="rounded-lg shadow-lg overflow-hidden" 
        nodeBorderRadius={8}
        nodeColor={(node) => {
          const statusColors = {
            completed: '#10b981',
            pending: '#3b82f6',
            stuck: '#facc15',
            unpicked: '#94a3b8'
          };
          return statusColors[node.data?.status] || '#ffffff';
        }}
      />
      
      <Background 
        variant="lines" 
        gap={30} 
        size={1} 
        color="#cbd5e1" 
        style={{ backgroundColor: '#f8fafc' }} 
      />

      {/* Node properties on right click */}
      {menu && <NodeProperties onClick={onPaneClick} {...menu} />}

      <Nodecard
        show={showModal}
        onClose={() => setShowModal(false)}
        nodeName={nodeName}
        description={nodeDescription}
        todos={todos}
        isCompleted={isCompleted}
        assignedTo={selectedNode?.data.assignedTo}
        creatorId={selectedNode?.data.creatorId}
        onToggleTodo={onToggleTodo}
        onMarkCompleted={onMarkCompleted}
        onAddTodo={onAddTodo}
        status={status}
        onStatusChange={onStatusChange}
        nodeData={selectedNode?.data}
        onDeadlineChange={onDeadlineChange}
        stuckReason={stuckReason}
        onStuckReasonChange={onStuckReasonChange}
      />
    </ReactFlow>
  );
};

const ReactFlowProviderContent = ({ selectedProjectId }) => {
  const { isSidebarOpen } = useGlobalContext();

  return (
    <ReactFlowProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`flex flex-col h-[calc(97vh-74px)] overflow-x-hidden ${
          isSidebarOpen ? "mr-64" : ""
        }`}
      >
        <Content selectedProjectId={selectedProjectId} />
      </motion.div>
    </ReactFlowProvider>
  );
};

export default ReactFlowProviderContent;