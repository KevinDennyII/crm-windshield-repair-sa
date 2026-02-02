import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useAIContext } from "@/contexts/ai-context";
import {
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Plus,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Briefcase,
  Truck,
  Users,
  Package,
  MoreHorizontal,
  Edit,
  Trash2,
  Car,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  Receipt,
} from "lucide-react";
import { generateReceiptPreview, determineReceiptType, getReceiptTypeLabel } from "@/lib/receipt-generator";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Contact, type Job, contactCategories } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  category: z.enum(contactCategories).default("customer"),
  isBusiness: z.boolean().default(false),
  businessName: z.string().optional(),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const categoryIcons: Record<string, typeof User> = {
  customer: User,
  dealer: Car,
  fleet: Truck,
  subcontractor: Users,
  vendor: Package,
  other: MoreHorizontal,
};

const avatarColors: string[] = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-red-500",
  "bg-yellow-500",
  "bg-indigo-500",
  "bg-teal-500",
];

const categoryBadgeColors: Record<string, string> = {
  customer: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  dealer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  fleet: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  subcontractor: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  vendor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

const ITEMS_PER_PAGE = 25;

export default function Contacts() {
  const { toast } = useToast();
  const { setSelectedEntity, clearSelectedEntity } = useAIContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (selectedContact) {
      setSelectedEntity({
        type: "contact",
        id: selectedContact.id,
        name: `${selectedContact.firstName} ${selectedContact.lastName}`,
        details: {
          phone: selectedContact.phone,
          email: selectedContact.email || undefined,
          category: selectedContact.category,
          businessName: selectedContact.businessName || undefined,
        },
      });
    } else {
      clearSelectedEntity();
    }
  }, [selectedContact, setSelectedEntity, clearSelectedEntity]);

  const { data: contacts, isLoading: loadingContacts, refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: contactJobs, isLoading: loadingJobs } = useQuery<Job[]>({
    queryKey: ["/api/contacts", selectedContact?.id, "jobs"],
    queryFn: async () => {
      if (!selectedContact?.id) return [];
      const res = await fetch(`/api/contacts/${selectedContact.id}/jobs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    enabled: !!selectedContact?.id,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/contacts/sync-from-jobs");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Success", description: data.message });
      refetchContacts();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to sync contacts", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Contact created successfully" });
      refetchContacts();
      setIsAddingContact(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create contact", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactFormData> }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedContact: Contact) => {
      toast({ title: "Success", description: "Contact updated successfully" });
      refetchContacts();
      setSelectedContact(updatedContact);
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Contact deleted successfully" });
      refetchContacts();
      setSelectedContact(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    },
  });

  const filteredContacts = (contacts || []).filter((contact) => {
    const matchesSearch = 
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (contact.businessName && contact.businessName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = filterCategory === "all" || contact.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
    const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const totalPages = Math.ceil(sortedContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = sortedContacts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <h1 className="text-2xl font-bold" data-testid="page-title">Contacts</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync-contacts"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", syncMutation.isPending && "animate-spin")} />
            Sync from Jobs
          </Button>
          <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-contact">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>Create a new contact in your directory.</DialogDescription>
              </DialogHeader>
              <ContactForm 
                onSubmit={(data) => createMutation.mutate(data)} 
                isPending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-background"
            data-testid="input-search-contacts"
          />
        </div>
        <Select value={filterCategory} onValueChange={(val) => {
          setFilterCategory(val);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-[180px] bg-background" data-testid="select-filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {contactCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden transition-all",
          selectedContact && "lg:flex-[2]"
        )}>
          <div className="flex-1 overflow-auto">
            {loadingContacts ? (
              <div className="p-8 text-center text-muted-foreground">Loading contacts...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No contacts found</p>
                <p className="text-sm mt-1">
                  {searchQuery || filterCategory !== "all" 
                    ? "Try adjusting your search or filters" 
                    : "Sync from jobs or add a new contact"}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-sm">
                    <th className="px-4 py-3 font-medium text-muted-foreground w-[280px]">Name</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Email</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">City</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedContacts.map((contact) => {
                    const fullName = `${contact.firstName} ${contact.lastName}`;
                    const displayName = contact.businessName || fullName;
                    const avatarColor = getAvatarColor(displayName);
                    const initials = getInitials(contact.firstName, contact.lastName);
                    
                    return (
                      <tr
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setActiveTab("details");
                        }}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          selectedContact?.id === contact.id && "bg-accent"
                        )}
                        data-testid={`contact-item-${contact.id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0",
                              avatarColor
                            )}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{displayName}</div>
                              {contact.businessName && (
                                <div className="text-sm text-muted-foreground truncate">{fullName}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm text-blue-600 dark:text-blue-400">
                            {formatPhoneNumber(contact.phone)}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                            {contact.email || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge 
                            variant="secondary" 
                            className={cn("capitalize text-xs", categoryBadgeColors[contact.category || "customer"])}
                          >
                            {contact.category || "customer"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {contact.city || "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedContacts.length)} of {sortedContacts.length}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-8 h-8"
                      data-testid={`button-page-${pageNum}`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedContact && (
          <div className="hidden lg:flex w-[400px] border-l flex-col bg-card overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Contact Details</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedContact(null)}
                data-testid="button-close-details"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-4 border-b">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-xl",
                  getAvatarColor(`${selectedContact.firstName} ${selectedContact.lastName}`)
                )}>
                  {getInitials(selectedContact.firstName, selectedContact.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate" data-testid="contact-name">
                    {selectedContact.businessName || `${selectedContact.firstName} ${selectedContact.lastName}`}
                  </h2>
                  {selectedContact.businessName && (
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedContact.firstName} {selectedContact.lastName}
                    </p>
                  )}
                  <Badge 
                    variant="secondary" 
                    className={cn("capitalize text-xs mt-1", categoryBadgeColors[selectedContact.category || "customer"])}
                  >
                    {selectedContact.category || "customer"}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-4">
                <Button 
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`tel:${selectedContact.phone}`, "_blank")}
                  data-testid="button-call-contact"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                {selectedContact.email && (
                  <Button 
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`mailto:${selectedContact.email}`, "_blank")}
                    data-testid="button-email-contact"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                )}
                <Button 
                  size="icon"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-edit-contact"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this contact?")) {
                      deleteMutation.mutate(selectedContact.id);
                    }
                  }}
                  data-testid="button-delete-contact"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="details" data-testid="tab-details" className="text-xs">
                  Details
                </TabsTrigger>
                <TabsTrigger value="jobs" data-testid="tab-jobs" className="text-xs">
                  Jobs
                </TabsTrigger>
                <TabsTrigger value="documents" data-testid="tab-documents" className="text-xs">
                  Documents
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-auto p-4 mt-0">
                <ContactDetails contact={selectedContact} />
              </TabsContent>

              <TabsContent value="jobs" className="flex-1 overflow-auto p-4 mt-0">
                <ContactJobs jobs={contactJobs} isLoading={loadingJobs} />
              </TabsContent>

              <TabsContent value="documents" className="flex-1 overflow-auto p-4 mt-0">
                <ContactDocuments jobs={contactJobs} isLoading={loadingJobs} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact information.</DialogDescription>
          </DialogHeader>
          {selectedContact && (
            <ContactForm 
              contact={selectedContact}
              onSubmit={(data) => updateMutation.mutate({ id: selectedContact.id, data })} 
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactForm({ 
  contact, 
  onSubmit, 
  isPending 
}: { 
  contact?: Contact; 
  onSubmit: (data: ContactFormData) => void; 
  isPending: boolean;
}) {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: contact?.firstName || "",
      lastName: contact?.lastName || "",
      phone: contact?.phone || "",
      email: contact?.email || "",
      streetAddress: contact?.streetAddress || "",
      city: contact?.city || "",
      state: contact?.state || "",
      zipCode: contact?.zipCode || "",
      category: (contact?.category as any) || "customer",
      isBusiness: contact?.isBusiness || false,
      businessName: contact?.businessName || "",
      notes: contact?.notes || "",
    },
  });

  const isBusiness = form.watch("isBusiness");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-contact-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {contactCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isBusiness"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-is-business"
                />
              </FormControl>
              <FormLabel className="font-normal">This is a business</FormLabel>
            </FormItem>
          )}
        />

        {isBusiness && (
          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-business-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-first-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-last-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="streetAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-street-address" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-city" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-state" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-zip" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} data-testid="textarea-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending} data-testid="button-save-contact">
            {isPending ? "Saving..." : contact ? "Update Contact" : "Add Contact"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function ContactDetails({ contact }: { contact: Contact }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p className="font-medium">{formatPhoneNumber(contact.phone)}</p>
          </div>
        </div>
        
        {contact.email && (
          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium break-all">{contact.email}</p>
            </div>
          </div>
        )}
        
        {(contact.streetAddress || contact.city) && (
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">
                {contact.streetAddress && <span>{contact.streetAddress}<br /></span>}
                {contact.city && `${contact.city}, `}{contact.state} {contact.zipCode}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {contact.notes && (
        <div className="pt-3 border-t">
          <p className="text-sm text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
        </div>
      )}
    </div>
  );
}

function ContactJobs({ jobs, isLoading }: { jobs?: Job[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="text-center text-muted-foreground py-4">Loading jobs...</div>;
  }
  
  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No jobs found for this contact</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const vehicle = job.vehicles?.[0];
        return (
          <Card key={job.id} className="hover-elevate cursor-pointer">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">#{job.jobNumber}</p>
                  {vehicle && (
                    <p className="text-xs text-muted-foreground truncate">
                      {vehicle.vehicleYear} {vehicle.vehicleMake} {vehicle.vehicleModel}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-xs capitalize">
                    {job.pipelineStage?.replace(/_/g, " ")}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">${job.totalDue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ContactDocuments({ jobs, isLoading }: { jobs?: Job[]; isLoading: boolean }) {
  const { toast } = useToast();
  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(null);
  
  if (isLoading) {
    return <div className="text-center text-muted-foreground py-4">Loading documents...</div>;
  }
  
  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No documents found</p>
      </div>
    );
  }
  
  const handleViewReceipt = async (job: Job) => {
    setGeneratingReceipt(job.id);
    try {
      const { blobUrl } = await generateReceiptPreview(job, {
        signatureImage: job.signatureImage,
      });
      window.open(blobUrl, "_blank");
    } catch (error) {
      console.error("Failed to generate receipt:", error);
      toast({
        title: "Error",
        description: "Failed to generate receipt",
        variant: "destructive",
      });
    } finally {
      setGeneratingReceipt(null);
    }
  };
  
  // Collect photos for the gallery section
  const photos: { jobNumber: string; type: string; url: string }[] = [];
  jobs.forEach((job) => {
    if (job.completionPhotos) {
      const completionPhotos = job.completionPhotos as Record<string, string>;
      Object.entries(completionPhotos).forEach(([key, url]) => {
        if (url) {
          photos.push({
            jobNumber: job.jobNumber,
            type: key.replace(/([A-Z])/g, " $1").trim(),
            url,
          });
        }
      });
    }
  });
  
  const handleViewSentReceipt = (job: Job) => {
    if (!job.receiptPdf) return;
    
    let base64Data = job.receiptPdf;
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };
  
  const sentReceipts = jobs.filter((job) => job.receiptPdf && job.receiptSentAt);
  const unsavedReceipts = jobs.filter((job) => !job.receiptPdf);
  
  return (
    <div className="space-y-4">
      {/* Sent Receipt Documents */}
      {sentReceipts.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Sent Receipts</h4>
          <div className="space-y-2">
            {sentReceipts.map((job) => {
              const vehicle = job.vehicles?.[0];
              const receiptType = determineReceiptType(job);
              const hasSignature = !!job.signatureImage;
              const sentDate = job.receiptSentAt ? new Date(job.receiptSentAt).toLocaleDateString() : null;
              
              return (
                <Card key={`sent-${job.id}`} className="overflow-hidden border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">Job #{job.jobNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getReceiptTypeLabel(receiptType)}
                          {vehicle && ` - ${vehicle.vehicleYear} ${vehicle.vehicleMake}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                            Sent {sentDate}
                          </Badge>
                          {hasSignature && (
                            <Badge variant="secondary" className="text-xs">Signed</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">${job.totalDue}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleViewSentReceipt(job)}
                        data-testid={`button-view-sent-receipt-${job.id}`}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Unsent Receipt Documents - can be generated on-the-fly */}
      {unsavedReceipts.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Available Receipts</h4>
          <div className="space-y-2">
            {unsavedReceipts.map((job) => {
              const vehicle = job.vehicles?.[0];
              const receiptType = determineReceiptType(job);
              const hasSignature = !!job.signatureImage;
              
              return (
                <Card key={job.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">Job #{job.jobNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getReceiptTypeLabel(receiptType)}
                          {vehicle && ` - ${vehicle.vehicleYear} ${vehicle.vehicleMake}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {hasSignature && (
                            <Badge variant="secondary" className="text-xs">Signed</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">${job.totalDue}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewReceipt(job)}
                        disabled={generatingReceipt === job.id}
                        data-testid={`button-view-receipt-${job.id}`}
                      >
                        {generatingReceipt === job.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Photos Gallery */}
      {photos.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Photos</h4>
          <div className="grid grid-cols-2 gap-2">
            {photos.map((photo, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-md overflow-hidden border bg-muted cursor-pointer hover:opacity-80"
                onClick={() => window.open(photo.url, "_blank")}
              >
                <img
                  src={photo.url}
                  alt={photo.type}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5">
                  <p className="truncate">#{photo.jobNumber}</p>
                  <p className="truncate text-white/80 capitalize">{photo.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
