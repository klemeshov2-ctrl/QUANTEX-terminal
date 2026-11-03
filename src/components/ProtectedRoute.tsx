import React from "react";
import { Navigate } from "react-router-dom";
import { UserAccountItem } from "./UnifiedStationSettings";

interface ProtectedRouteProps {
  isAuthenticated: boolean;
  currentUser: UserAccountItem;
  requiredRole?: "admin" | "user";
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  currentUser,
  requiredRole,
  children
}) => {
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === "admin" && currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
