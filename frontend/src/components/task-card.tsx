import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { Task, useUpdateTask, getListTasksQueryKey } from "@/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function TaskCard({ task, isAdmin = false }: { task: Task; isAdmin?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();

  const isCompleted = task.status === "completed";

  const handleToggleStatus = () => {
    const newStatus = isCompleted ? "pending" : "completed";
    updateTask.mutate(
      { id: task.id, data: { status: newStatus } },
      {
        onSuccess: (updatedTask) => {
          toast({
            title: "Task updated",
            description: `Task marked as ${newStatus}`,
          });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Failed to update task",
          });
        },
      }
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "default";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high": return <AlertCircle className="w-3 h-3 mr-1" />;
      case "medium": return <Clock className="w-3 h-3 mr-1" />;
      case "low": return <Circle className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  return (
    <Card className={`transition-all duration-200 ${isCompleted ? 'opacity-70 grayscale-[0.5]' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-4">
          <CardTitle className={`text-lg font-semibold ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </CardTitle>
          <Badge variant={getPriorityColor(task.priority) as any} className="capitalize shrink-0">
            {getPriorityIcon(task.priority)}
            {task.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {task.due_date && (
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Due {format(new Date(task.due_date), "MMM d, yyyy")}
            </div>
          )}
          {isAdmin && task.assigned_to_username && (
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold mr-1.5">
                {task.assigned_to_username.charAt(0).toUpperCase()}
              </div>
              {task.assigned_to_username}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex justify-end">
        <Button 
          variant={isCompleted ? "outline" : "default"} 
          size="sm" 
          onClick={handleToggleStatus}
          disabled={updateTask.isPending}
          className="w-full sm:w-auto"
        >
          {updateTask.isPending ? (
            "Updating..."
          ) : isCompleted ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
              Completed
            </>
          ) : (
            <>
              <Circle className="w-4 h-4 mr-2" />
              Mark Complete
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
