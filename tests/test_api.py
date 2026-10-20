import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.core.config import settings
from app.services.realtime_service import RealtimeService

client = TestClient(app)

def test_health_check():
    """Verify both /health endpoints return healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ai-kubernetes-agent"

def test_root_endpoint():
    """Verify root / endpoint returns service metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert data["health"] == "/health"

def test_settings_loaded():
    """Verify settings are correctly configured for InsForge and OpenRouter."""
    assert "xq2heej9" in settings.INSFORGE_API_BASE_URL
    assert settings.OPENROUTER_MODEL == "openai/gpt-4o"
    assert len(settings.OPENROUTER_API_KEY) > 0
    assert len(settings.INSFORGE_API_KEY) > 0

def test_get_contexts():
    """Verify /contexts endpoint returns Kubernetes contexts."""
    response = client.get("/contexts")
    assert response.status_code == 200
    data = response.json()
    assert "contexts" in data
    assert "current_context" in data
    assert isinstance(data["contexts"], list)

def test_realtime_progress_publish():
    """Verify progress event can be published to InsForge progress_events table."""
    # Test with a mock user UUID
    test_user_id = "0d4219fa-7f74-4bf5-8d09-248d06480a53"
    result = RealtimeService.publish_progress(test_user_id, "Test Step Check", "active")
    assert result is True

def test_sandbox_investigation():
    """Verify InvestigationService correctly produces sandbox telemetry for k8s-sandbox-cluster."""
    from app.services.investigation_service import InvestigationService
    evidence = InvestigationService.run_investigation(context="k8s-sandbox-cluster")
    assert "pods" in evidence
    assert "logs" in evidence
    assert "events" in evidence
    assert "deployments" in evidence
    assert "network" in evidence
    assert evidence["pods"]["success"] is True
    assert evidence["pods"]["healthy"] is False
    assert len(evidence["pods"]["problematic_pods"]) > 0
    assert "payment-service" in evidence["pods"]["problematic_pods"][0]["name"]

def test_investigate_sandbox_endpoint():
    """Verify /investigate endpoint works with sandbox context and AI reasoning."""
    response = client.post("/investigate", json={"context": "k8s-sandbox-cluster"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "diagnosis" in data
    assert "investigation" in data
    assert "root_cause" in data["diagnosis"]
    assert "fix" in data["diagnosis"]
    assert data["diagnosis"]["confidence"] > 0
