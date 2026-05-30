import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetMe, 
  useListConversations, 
  useCreateConversation, 
  useGetConversation,
  useUpdateConversation,
  useDeleteConversation,
  useSendMessage,
  getListConversationsQueryKey,
  getGetConversationQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  MessageSquare, 
  MoreHorizontal, 
  Plus, 
  Send, 
  LogOut, 
  Edit2, 
  Trash2,
  TerminalSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Chat() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: user } = useGetMe();
  const { data: conversations = [] } = useListConversations();
  
  const conversationId = id ? parseInt(id, 10) : undefined;
  const { data: activeConversation } = useGetConversation(conversationId!, {
    query: { enabled: !!conversationId, queryKey: getGetConversationQueryKey(conversationId!) }
  });

  const createChat = useCreateConversation();
  const updateChat = useUpdateConversation();
  const deleteChat = useDeleteConversation();
  const sendMessage = useSendMessage();

  const sortedConversations = [...conversations].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const handleNewChat = () => {
    createChat.mutate(
      { data: { title: "New Conversation" } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setLocation(`/chat/${res.id}`);
        }
      }
    );
  };

  const handleDeleteChat = (chatId: number) => {
    deleteChat.mutate(
      { id: chatId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          if (conversationId === chatId) {
            setLocation("/");
          }
        }
      }
    );
  };

  const handleRenameSubmit = (chatId: number) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    updateChat.mutate(
      { id: chatId, data: { title: editTitle } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setEditingId(null);
        }
      }
    );
  };

  const handleSend = () => {
    if (!message.trim() || sendMessage.isPending) return;

    if (!conversationId) {
      // Need to create conversation first
      createChat.mutate(
        { data: { title: message.slice(0, 30) + (message.length > 30 ? "..." : "") } },
        {
          onSuccess: (newChat) => {
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            setLocation(`/chat/${newChat.id}`);
            
            // Wait a tick for router to catch up before sending message
            setTimeout(() => {
              sendMessage.mutate(
                { id: newChat.id, data: { content: message } },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(newChat.id) });
                    queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
                  }
                }
              );
            }, 100);
            setMessage("");
          }
        }
      );
    } else {
      const currentMessage = message;
      setMessage(""); // Optimistic clear
      
      sendMessage.mutate(
        { id: conversationId, data: { content: currentMessage } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(conversationId) });
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          },
          onError: () => {
            setMessage(currentMessage); // Restore on error
          }
        }
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setLocation("/login");
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages, sendMessage.isPending]);

  const renderMessageContent = (content: string) => {
    // Basic markdown rendering for bold and code
    const parts = content.split(/(\*\*.*?\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <span key={i} className="font-mono bg-muted px-1.5 py-0.5 rounded text-sm text-primary">{part.slice(1, -1)}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-[260px] flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-3">
          <Button 
            onClick={handleNewChat} 
            className="w-full justify-start gap-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground border border-sidebar-border/50 shadow-sm transition-all"
            variant="secondary"
          >
            <Plus size={16} className="text-primary" />
            <span className="font-medium tracking-wide">New Chat</span>
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
            {sortedConversations.map((chat) => (
              <div 
                key={chat.id}
                className={`group flex items-center justify-between px-3 py-2.5 text-sm rounded-md cursor-pointer transition-colors ${
                  conversationId === chat.id 
                    ? "bg-sidebar-accent/60 text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
                }`}
                onClick={() => {
                  if (editingId !== chat.id) setLocation(`/chat/${chat.id}`);
                }}
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <MessageSquare size={16} className={conversationId === chat.id ? "text-primary flex-shrink-0" : "text-sidebar-foreground/50 flex-shrink-0"} />
                  {editingId === chat.id ? (
                    <Input 
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleRenameSubmit(chat.id)}
                      onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit(chat.id)}
                      autoFocus
                      className="h-7 px-2 py-0 text-sm bg-background border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="truncate font-medium">{chat.title}</div>
                      <div className="text-[10px] text-sidebar-foreground/40 mt-0.5">{formatDistanceToNow(new Date(chat.updated_at), { addSuffix: true })}</div>
                    </div>
                  )}
                </div>
                
                {editingId !== chat.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-all">
                        <MoreHorizontal size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(chat.id);
                        setEditTitle(chat.title);
                      }}>
                        <Edit2 size={14} className="mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border mt-auto">
          <div className="flex items-center justify-between bg-sidebar-accent/30 rounded-md p-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-8 w-8 border border-primary/20 bg-sidebar-accent">
                <AvatarFallback className="text-xs bg-transparent text-primary font-bold">
                  {user?.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="truncate">
                <div className="text-sm font-medium text-sidebar-foreground">{user?.username}</div>
                <div className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-background bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sidebar-accent/10 via-background to-background">
        
        {/* Header - mobile only typically, but good for context */}
        <div className="h-14 border-b border-border/50 flex items-center px-6 lg:hidden sticky top-0 bg-background/80 backdrop-blur z-10">
          <span className="font-semibold tracking-wide text-foreground">Nexus Chat</span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
            {!conversationId || !activeConversation ? (
              <div className="h-full min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
                <div className="h-16 w-16 bg-sidebar-accent rounded-2xl flex items-center justify-center mb-6 shadow-lg border border-border">
                  <TerminalSquare size={32} className="text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Welcome to Nexus</h2>
                <p className="text-muted-foreground max-w-md">
                  Your secure workspace for focused thinking. Send a message to start a new conversation.
                </p>
              </div>
            ) : (
              <>
                {activeConversation.messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`flex gap-4 max-w-[85%] ${
                        msg.role === 'user' 
                          ? 'bg-primary text-primary-foreground px-5 py-3.5 rounded-2xl rounded-tr-sm shadow-sm' 
                          : 'px-2 py-2'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <Avatar className="h-8 w-8 mt-1 flex-shrink-0 border border-primary/20">
                          <AvatarFallback className="bg-sidebar-accent text-primary">
                            <TerminalSquare size={16} />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={`leading-relaxed whitespace-pre-wrap break-words ${msg.role === 'assistant' ? 'text-foreground pt-1' : ''}`}>
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {sendMessage.isPending && (
                  <div className="flex w-full justify-start">
                    <div className="flex gap-4 max-w-[85%] px-2 py-2">
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0 border border-primary/20">
                        <AvatarFallback className="bg-sidebar-accent text-primary">
                          <TerminalSquare size={16} />
                        </AvatarFallback>
                      </Avatar>
                      <div className="pt-2 flex gap-1">
                        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 bg-gradient-to-t from-background via-background to-transparent sticky bottom-0">
          <div className="max-w-3xl mx-auto relative group">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 blur-xl transition-opacity opacity-0 group-hover:opacity-100 duration-500"></div>
            <div className="relative flex items-end gap-2 bg-sidebar-accent/50 border border-border shadow-lg rounded-xl p-2 transition-colors focus-within:border-primary/50 focus-within:bg-sidebar-accent/80">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Nexus..."
                className="min-h-[44px] max-h-48 resize-none bg-transparent border-0 focus-visible:ring-0 px-3 py-3 shadow-none overflow-y-auto"
                rows={1}
                disabled={sendMessage.isPending}
              />
              <Button 
                onClick={handleSend}
                disabled={!message.trim() || sendMessage.isPending}
                size="icon"
                className="h-10 w-10 shrink-0 rounded-lg mb-0.5 ml-1 transition-all"
              >
                <Send size={18} className={message.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
              </Button>
            </div>
            <div className="text-center mt-2 text-[11px] text-muted-foreground font-medium">
              Nexus Chat can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
