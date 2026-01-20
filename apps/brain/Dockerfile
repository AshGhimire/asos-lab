FROM python:3.11-slim

WORKDIR /app

# Install dependencies (cached)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src ./src

# Create a non-root user for security (Kopf compliant)
RUN useradd -m kopf
USER kopf

# Run kopf
CMD ["kopf", "run", "src/operator.py", "--verbose"]
