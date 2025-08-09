package arc.teamManager.controllers;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import arc.teamManager.dto.DeadlineUpdateRequest;
import arc.teamManager.dto.TodoRequest;
import arc.teamManager.entities.GraphEdge;
import arc.teamManager.entities.GraphNode;
import arc.teamManager.entities.Todo;
import arc.teamManager.models.GraphDataRequest;
import arc.teamManager.repositories.EdgeRepository;
import arc.teamManager.repositories.NodeRepository;
import arc.teamManager.services.NodeService;
import arc.teamManager.services.TodoService;

@RestController
public class NodeController {
    @Autowired
    private NodeRepository nodeRepo;

    @Autowired
    private EdgeRepository edgeRepo;

    @Autowired
    private TodoService todoService;

    @Autowired
    private NodeService nodeService;

    Logger log = LoggerFactory.getLogger(this.getClass());

    @PostMapping("/save")
    public ResponseEntity<?> saveGraph(@RequestBody GraphDataRequest request) {
        nodeRepo.saveAll(request.getNodes());
        edgeRepo.saveAll(request.getEdges());
        return ResponseEntity.ok("Saved successfully");
    }

    // to modify description
    @PostMapping("/updateDescription")
    public ResponseEntity<String> updateDescription(@RequestBody String description, @RequestBody String nodeId) {
        String updatedDescription = nodeService.updatedDescription(description, nodeId);
        return ResponseEntity.ok("");
    }

    public String postMethodName(@RequestBody String entity) {
        // TODO: process POST request

        return entity;
    }

    @GetMapping("/load/{projectId}")
    public ResponseEntity<GraphDataRequest> loadGraph(@PathVariable String projectId) {
        try {
            List<GraphNode> nodes = nodeRepo.findByProjectId(projectId);
            List<GraphEdge> edges = edgeRepo.findByProjectId(projectId);

            GraphDataRequest response = new GraphDataRequest();
            response.setNodes(nodes);
            response.setEdges(edges);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new GraphDataRequest());
        }
    }

    // Todos controllers
    @GetMapping("/nodes/{nodeId}/todos")
    public ResponseEntity<List<Todo>> getTodos(@PathVariable String nodeId) {
        System.out.println("get todos called");
        List<Todo> todos = todoService.getTodosByNodeId(nodeId);
        log.info("todos get -->" + todos);
        return ResponseEntity.ok(todos);
    }

    // 2. Add a todo to a node
    @PostMapping("/nodes/{nodeId}/todos")
    public Todo addTodo(@PathVariable String nodeId, @RequestBody TodoRequest rq) {
        log.info("inside addTodo --> ");
        log.info("node Id --> " + nodeId);
        log.info("Req.get(task) -->" + rq.getTask());
        log.info("creator member id -->" + rq.getMemberId());
        return todoService.addTodo(nodeId, rq, rq.getMemberId());
    }

    // 3. Toggle a todo (mark done/undone)
    @PostMapping("/todos/{todoId}/toggle")
    public Todo toggleTodo(@PathVariable Long todoId) {
        return todoService.toggleTodo(todoId);
    }

    // 4. Mark node as complete (if all todos are done)
    @PostMapping("/nodes/{nodeId}/complete")
    public GraphNode markNodeCompleted(@PathVariable String nodeId) {
        return todoService.markNodeComplete(nodeId);
    }

    @PostMapping("/nodes/{nodeId}/deleteNode")
    public GraphNode deleteNode(@PathVariable String nodeId) {
        return nodeService.deleteNode(nodeId);
    }

    @PostMapping("/nodes/{nodeId}/deleteEdges")
    public String deleteEdges(@PathVariable String nodeId) {
        return nodeService.deleteNodeEdges(nodeId);
    }

    @PostMapping("/nodes/{id}/update-deadline")
    public ResponseEntity<String> updateDeadline(
            @PathVariable("id") String nodeId,
            @RequestBody Map<String, String> payload) {
        String newDeadline = payload.get("deadline");
        try {
            nodeService.updateDeadline(nodeId, newDeadline);
            return ResponseEntity.ok("Deadline updated successfully.");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error updating deadline: " + e.getMessage());
        }
    }

    @PostMapping("/nodes/{nodeId}/update-stuck-reason")
    public ResponseEntity<String> updateStuckReason(
            @PathVariable("nodeId") String nodeId,
            @RequestBody Map<String, String> payload) {
        String stuckReason = payload.get("stuckReason");
        try {
            nodeService.updateStuckReason(nodeId, stuckReason);
            return ResponseEntity.ok("Stuck reason updated successfully.");
        } catch (Exception e) {
            log.error("Error updating stuck reason: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error updating stuck reason: " + e.getMessage());
        }
    }
}
