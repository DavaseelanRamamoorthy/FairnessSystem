"use client";

import { alpha } from "@mui/material/styles";
import { IconButton, Tooltip } from "@mui/material";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";

type CreatePlayerIconButtonProps = {
  onClick: () => void;
  tooltip?: string;
  disabled?: boolean;
};

export default function CreatePlayerIconButton({
  onClick,
  tooltip = "Create Player",
  disabled = false
}: CreatePlayerIconButtonProps) {
  return (
    <Tooltip title={tooltip} arrow>
      <span>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          aria-label={tooltip}
          sx={{
            width: 52,
            height: 52,
            borderRadius: 3,
            position: "relative",
            background:
              "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 58%, var(--app-header-end) 100%)",
            color: "#F8FAFC",
            boxShadow: (theme) => `0 12px 28px ${alpha(theme.palette.grey[900], 0.2)}`,
            transition: "transform 160ms ease, box-shadow 160ms ease",
            "&:hover": {
              background:
                "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 58%, var(--app-header-end) 100%)",
              boxShadow: (theme) => `0 14px 30px ${alpha(theme.palette.grey[900], 0.24)}`,
              transform: "translateY(-1px)"
            },
            "&.Mui-disabled": {
              background:
                "linear-gradient(135deg, var(--app-header-start) 0%, var(--app-header-mid) 58%, var(--app-header-end) 100%)",
              color: alpha("#F8FAFC", 0.55)
            },
            "&::before": {
              content: '""',
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: -7,
              width: "58%",
              height: 4,
              borderRadius: 999,
              background: "linear-gradient(180deg, var(--app-danger-main) 0%, var(--app-warning-main) 100%)",
              opacity: disabled ? 0.4 : 1
            },
            "&::after": {
              content: '""',
              position: "absolute",
              top: 11,
              right: 11,
              width: 12,
              height: 12,
              opacity: disabled ? 0.4 : 1,
              backgroundImage: [
                `linear-gradient(${alpha("#EF4444", 0.9)} 0 0)`,
                `linear-gradient(${alpha("#EF4444", 0.9)} 0 0)`
              ].join(", "),
              backgroundRepeat: "no-repeat",
              backgroundSize: ["12px 1.5px", "1.5px 12px"].join(", "),
              backgroundPosition: ["center", "center"].join(", ")
            }
          }}
        >
          <PersonAddAlt1RoundedIcon sx={{ fontSize: 22 }} />
        </IconButton>
      </span>
    </Tooltip>
  );
}
