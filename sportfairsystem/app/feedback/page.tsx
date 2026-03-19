"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import BugReportRoundedIcon from "@mui/icons-material/BugReportRounded";
import FeedbackRoundedIcon from "@mui/icons-material/FeedbackRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import PaginationFooter from "@/app/components/common/PaginationFooter";
import TeamPageHeader from "@/app/components/common/TeamPageHeader";
import { useAuth } from "@/app/context/AuthContext";
import { usePagination } from "@/app/hooks/usePagination";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MODULES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  FeedbackCategory,
  FeedbackFilters,
  FeedbackFormValues,
  FeedbackModule,
  FeedbackPriority,
  FeedbackRecord,
  FeedbackStatus,
  FeedbackWorkspaceData,
  getFeedbackWorkspace,
  hasFeedbackModuleSupport,
  submitFeedback,
  updateFeedbackStatus
} from "@/app/services/feedbackService";
import { formatDate } from "@/app/utils/formatDate";

const DEFAULT_FORM_VALUES: FeedbackFormValues = {
  category: "Bug",
  module: "General",
  title: "",
  description: "",
  priority: "Medium"
};
const EMPTY_FEEDBACK: FeedbackRecord[] = [];

type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  accent: string;
};

function MetricCard({ label, value, helper, icon, accent }: MetricCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accent,
                  backgroundColor: `${accent}18`
                }}
              >
                {icon}
              </Box>

              <Typography variant="subtitle2" color="text.secondary">
                {label}
              </Typography>
            </Stack>

            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: accent,
                boxShadow: `0 0 0 5px ${accent}22`
              }}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {helper}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function getCategoryChipColor(category: FeedbackCategory) {
  switch (category) {
    case "Bug":
      return "error";
    case "Question":
      return "info";
    case "Improvement":
      return "success";
    default:
      return "default";
  }
}

function getPriorityChipColor(priority: FeedbackPriority) {
  switch (priority) {
    case "High":
      return "error";
    case "Medium":
      return "warning";
    default:
      return "default";
  }
}

function getStatusChipColor(status: FeedbackStatus) {
  switch (status) {
    case "Closed":
      return "success";
    case "In Progress":
      return "warning";
    case "Reviewed":
      return "info";
    default:
      return "default";
  }
}

function FeedbackMobileCard({
  item,
  showSubmitter,
  canManageStatus,
  updatingFeedbackId,
  onStatusChange
}: {
  item: FeedbackRecord;
  showSubmitter: boolean;
  canManageStatus: boolean;
  updatingFeedbackId: string | null;
  onStatusChange: (feedbackId: string, nextStatus: FeedbackStatus) => void;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography fontWeight={700}>
              {item.title}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={item.category} color={getCategoryChipColor(item.category)} size="small" variant="outlined" />
              <Chip label={item.module} size="small" variant="outlined" />
              <Chip label={item.priority} color={getPriorityChipColor(item.priority)} size="small" variant="outlined" />
            </Stack>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>

          <Stack spacing={0.35}>
            <Typography variant="caption" color="text.secondary">
              Submitted {item.createdAt ? formatDate(item.createdAt) : "Unknown Date"}
            </Typography>
            {showSubmitter && item.submittedByDisplayName && (
              <Typography variant="caption" color="text.secondary">
                Submitted by {item.submittedByDisplayName}
              </Typography>
            )}
          </Stack>

          {canManageStatus ? (
            <FormControl size="small" fullWidth>
              <InputLabel id={`feedback-status-mobile-${item.id}`}>Status</InputLabel>
              <Select
                labelId={`feedback-status-mobile-${item.id}`}
                value={item.status}
                label="Status"
                disabled={updatingFeedbackId === item.id}
                onChange={(event) => onStatusChange(item.id, event.target.value as FeedbackStatus)}
              >
                {FEEDBACK_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Chip
              label={item.status}
              color={getStatusChipColor(item.status)}
              size="small"
              sx={{ alignSelf: "flex-start" }}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function FeedbackPage() {
  const { isAdmin } = useAuth();
  const [workspace, setWorkspace] = useState<FeedbackWorkspaceData | null>(null);
  const [moduleReady, setModuleReady] = useState<boolean | null>(null);
  const [formValues, setFormValues] = useState<FeedbackFormValues>(DEFAULT_FORM_VALUES);
  const [filters, setFilters] = useState<FeedbackFilters>({
    category: "all",
    module: "all",
    status: "all"
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadFeedbackWorkspace = useCallback(async (nextFilters: FeedbackFilters) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const isSupported = await hasFeedbackModuleSupport();
      setModuleReady(isSupported);

      if (!isSupported) {
        setWorkspace(null);
        return;
      }

      const nextWorkspace = await getFeedbackWorkspace(nextFilters);
      setWorkspace(nextWorkspace);
    } catch (error) {
      setWorkspace(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load feedback right now."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeedbackWorkspace(filters);
  }, [filters, loadFeedbackWorkspace]);

  const myFeedback = workspace?.myFeedback ?? EMPTY_FEEDBACK;
  const teamFeedback = workspace?.teamFeedback ?? EMPTY_FEEDBACK;
  const myFeedbackPagination = usePagination({
    items: myFeedback,
    pageSize: 5,
    resetKeys: [myFeedback.length]
  });
  const teamFeedbackPagination = usePagination({
    items: teamFeedback,
    pageSize: 5,
    resetKeys: [teamFeedback.length, filters.category, filters.module, filters.status]
  });

  const openTeamFeedbackCount = useMemo(
    () => teamFeedback.filter((item) => item.status !== "Closed").length,
    [teamFeedback]
  );

  const handleFormChange = (field: keyof FeedbackFormValues, value: string) => {
    setFormValues((current) => ({
      ...current,
      [field]: value
    }));
    setSuccessMessage(null);
  };

  const handleFilterChange = (field: keyof FeedbackFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleSubmitFeedback = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await submitFeedback(formValues);
      setFormValues(DEFAULT_FORM_VALUES);
      await loadFeedbackWorkspace(filters);
      setSuccessMessage("Your feedback has been submitted and is ready for review.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not submit your feedback."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (feedbackId: string, nextStatus: FeedbackStatus) => {
    try {
      setUpdatingFeedbackId(feedbackId);
      setErrorMessage(null);
      setSuccessMessage(null);

      await updateFeedbackStatus(feedbackId, nextStatus);
      await loadFeedbackWorkspace(filters);
      setSuccessMessage(`Feedback status updated to ${nextStatus}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update the feedback status."
      );
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  return (
    <Container maxWidth="xl">
      <Stack spacing={4}>
        <TeamPageHeader
          eyebrow="Team Workspace"
          title="Feedback"
          description="Share bugs, suggestions, improvements, and questions from real team usage so the product can improve from actual workflows."
        />

        <AutoHideAlert severity="info" variant="outlined">
          Members can submit feedback and track their own items here. Admins can also review team feedback and update status.
        </AutoHideAlert>

        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {successMessage && (
          <AutoHideAlert severity="success" resetKey={successMessage}>
            {successMessage}
          </AutoHideAlert>
        )}

        {isLoading ? (
          <Box
            sx={{
              minHeight: 320,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <CircularProgress />
          </Box>
        ) : moduleReady === false ? (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={1}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Feedback is not available yet
                </Typography>
                <Typography color="text.secondary">
                  This environment does not have the feedback module data support yet. Apply the feedback SQL migration first, then refresh this page.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  label="My Feedback"
                  value={myFeedback.length}
                  helper="Items you have submitted in this team workspace"
                  icon={<FeedbackRoundedIcon />}
                  accent="#1E40AF"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  label="Open Items"
                  value={myFeedback.filter((item) => item.status !== "Closed").length}
                  helper="Your submitted items that are still active"
                  icon={<BugReportRoundedIcon />}
                  accent="#E53935"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <MetricCard
                  label="Team Queue"
                  value={isAdmin ? openTeamFeedbackCount : myFeedback.length}
                  helper={isAdmin ? "Team feedback items that are not closed" : "Your current feedback queue"}
                  icon={<AssignmentTurnedInRoundedIcon />}
                  accent="#0F9D58"
                />
              </Grid>
            </Grid>

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Submit Feedback
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Capture real bugs, suggestions, improvements, and questions from actual usage without leaving the app.
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ px: 3, pb: 3 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="feedback-category-label">Category</InputLabel>
                        <Select
                          labelId="feedback-category-label"
                          label="Category"
                          value={formValues.category}
                          onChange={(event: SelectChangeEvent<FeedbackCategory>) =>
                            handleFormChange("category", event.target.value)
                          }
                        >
                          {FEEDBACK_CATEGORIES.map((category) => (
                            <MenuItem key={category} value={category}>
                              {category}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="feedback-module-label">Module</InputLabel>
                        <Select
                          labelId="feedback-module-label"
                          label="Module"
                          value={formValues.module}
                          onChange={(event: SelectChangeEvent<FeedbackModule>) =>
                            handleFormChange("module", event.target.value)
                          }
                        >
                          {FEEDBACK_MODULES.map((moduleName) => (
                            <MenuItem key={moduleName} value={moduleName}>
                              {moduleName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="feedback-priority-label">Priority</InputLabel>
                        <Select
                          labelId="feedback-priority-label"
                          label="Priority"
                          value={formValues.priority}
                          onChange={(event: SelectChangeEvent<FeedbackPriority>) =>
                            handleFormChange("priority", event.target.value)
                          }
                        >
                          {FEEDBACK_PRIORITIES.map((priority) => (
                            <MenuItem key={priority} value={priority}>
                              {priority}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Title"
                        value={formValues.title}
                        onChange={(event) => handleFormChange("title", event.target.value)}
                        helperText={`${formValues.title.trim().length}/120 characters`}
                      />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={5}
                        label="Description"
                        value={formValues.description}
                        onChange={(event) => handleFormChange("description", event.target.value)}
                        helperText="Describe the problem, suggestion, or question in enough detail for the team to act on it."
                      />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          Title is required and description must be at least 10 characters.
                        </Typography>
                        <Button
                          variant="contained"
                          onClick={() => void handleSubmitFeedback()}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "Submitting..." : "Submit Feedback"}
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <ForumRoundedIcon color="primary" />
                    <Stack spacing={0.25}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        My Feedback
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Track the items you have raised and follow their current review status.
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                {myFeedback.length === 0 ? (
                  <Box sx={{ px: 3, pb: 3 }}>
                    <Typography color="text.secondary">
                      No feedback submitted yet. Use the form above to share something.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: { xs: "block", md: "none" }, px: 2, pb: 2 }}>
                      <Stack spacing={2}>
                        {myFeedbackPagination.paginatedItems.map((item) => (
                          <FeedbackMobileCard
                            key={item.id}
                            item={item}
                            showSubmitter={false}
                            canManageStatus={false}
                            updatingFeedbackId={updatingFeedbackId}
                            onStatusChange={handleStatusChange}
                          />
                        ))}
                      </Stack>
                    </Box>

                    <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: "24%" }}>Title</TableCell>
                            <TableCell sx={{ width: "10%" }}>Category</TableCell>
                            <TableCell sx={{ width: "12%" }}>Module</TableCell>
                            <TableCell sx={{ width: "10%" }}>Priority</TableCell>
                            <TableCell sx={{ width: "10%" }}>Status</TableCell>
                            <TableCell sx={{ width: "12%" }}>Date</TableCell>
                            <TableCell>Description</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {myFeedbackPagination.paginatedItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Typography fontWeight={700}>
                                  {item.title}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip label={item.category} color={getCategoryChipColor(item.category)} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>{item.module}</TableCell>
                              <TableCell>
                                <Chip label={item.priority} color={getPriorityChipColor(item.priority)} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>
                                <Chip label={item.status} color={getStatusChipColor(item.status)} size="small" />
                              </TableCell>
                              <TableCell>{item.createdAt ? formatDate(item.createdAt) : "Unknown Date"}</TableCell>
                              <TableCell>{item.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {myFeedback.length > 5 && (
                      <PaginationFooter
                        pageStart={myFeedbackPagination.pageStart}
                        pageEnd={myFeedbackPagination.pageEnd}
                        totalCount={myFeedbackPagination.totalCount}
                        hasPreviousPage={myFeedbackPagination.hasPreviousPage}
                        hasNextPage={myFeedbackPagination.hasNextPage}
                        onPrevious={myFeedbackPagination.goToPreviousPage}
                        onNext={myFeedbackPagination.goToNextPage}
                        sx={{ px: 3, py: 2 }}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {isAdmin && workspace?.canManageTeamFeedback && (
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                    <Stack spacing={2}>
                      <Stack spacing={0.25}>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          Team Feedback
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Review team submissions, filter the queue, and move items through the status workflow.
                        </Typography>
                      </Stack>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel id="team-feedback-category-label">Category</InputLabel>
                            <Select
                              labelId="team-feedback-category-label"
                              label="Category"
                              value={filters.category ?? "all"}
                              onChange={(event) => handleFilterChange("category", event.target.value)}
                            >
                              <MenuItem value="all">All Categories</MenuItem>
                              {FEEDBACK_CATEGORIES.map((category) => (
                                <MenuItem key={category} value={category}>
                                  {category}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel id="team-feedback-module-label">Module</InputLabel>
                            <Select
                              labelId="team-feedback-module-label"
                              label="Module"
                              value={filters.module ?? "all"}
                              onChange={(event) => handleFilterChange("module", event.target.value)}
                            >
                              <MenuItem value="all">All Modules</MenuItem>
                              {FEEDBACK_MODULES.map((moduleName) => (
                                <MenuItem key={moduleName} value={moduleName}>
                                  {moduleName}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel id="team-feedback-status-label">Status</InputLabel>
                            <Select
                              labelId="team-feedback-status-label"
                              label="Status"
                              value={filters.status ?? "all"}
                              onChange={(event) => handleFilterChange("status", event.target.value)}
                            >
                              <MenuItem value="all">All Statuses</MenuItem>
                              {FEEDBACK_STATUSES.map((status) => (
                                <MenuItem key={status} value={status}>
                                  {status}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Stack>
                  </Box>

                  {teamFeedback.length === 0 ? (
                    <Box sx={{ px: 3, pb: 3 }}>
                      <Typography color="text.secondary">
                        No team feedback found for the selected filters.
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: { xs: "block", md: "none" }, px: 2, pb: 2 }}>
                        <Stack spacing={2}>
                          {teamFeedbackPagination.paginatedItems.map((item) => (
                            <FeedbackMobileCard
                              key={item.id}
                              item={item}
                              showSubmitter
                              canManageStatus
                              updatingFeedbackId={updatingFeedbackId}
                              onStatusChange={handleStatusChange}
                            />
                          ))}
                        </Stack>
                      </Box>

                      <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ width: "18%" }}>Title</TableCell>
                              <TableCell sx={{ width: "10%" }}>Category</TableCell>
                              <TableCell sx={{ width: "10%" }}>Module</TableCell>
                              <TableCell sx={{ width: "10%" }}>Priority</TableCell>
                              <TableCell sx={{ width: "12%" }}>Submitted By</TableCell>
                              <TableCell sx={{ width: "12%" }}>Date</TableCell>
                              <TableCell sx={{ width: "14%" }}>Status</TableCell>
                              <TableCell>Description</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {teamFeedbackPagination.paginatedItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <Typography fontWeight={700}>
                                    {item.title}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip label={item.category} color={getCategoryChipColor(item.category)} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell>{item.module}</TableCell>
                                <TableCell>
                                  <Chip label={item.priority} color={getPriorityChipColor(item.priority)} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell>{item.submittedByDisplayName ?? "Unknown User"}</TableCell>
                                <TableCell>{item.createdAt ? formatDate(item.createdAt) : "Unknown Date"}</TableCell>
                                <TableCell>
                                  <FormControl size="small" fullWidth>
                                    <InputLabel id={`feedback-status-${item.id}`}>Status</InputLabel>
                                    <Select
                                      labelId={`feedback-status-${item.id}`}
                                      label="Status"
                                      value={item.status}
                                      disabled={updatingFeedbackId === item.id}
                                      onChange={(event) => handleStatusChange(item.id, event.target.value as FeedbackStatus)}
                                    >
                                      {FEEDBACK_STATUSES.map((status) => (
                                        <MenuItem key={status} value={status}>
                                          {status}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </TableCell>
                                <TableCell>{item.description}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {teamFeedback.length > 5 && (
                        <PaginationFooter
                          pageStart={teamFeedbackPagination.pageStart}
                          pageEnd={teamFeedbackPagination.pageEnd}
                          totalCount={teamFeedbackPagination.totalCount}
                          hasPreviousPage={teamFeedbackPagination.hasPreviousPage}
                          hasNextPage={teamFeedbackPagination.hasNextPage}
                          onPrevious={teamFeedbackPagination.goToPreviousPage}
                          onNext={teamFeedbackPagination.goToNextPage}
                          sx={{ px: 3, py: 2 }}
                        />
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
