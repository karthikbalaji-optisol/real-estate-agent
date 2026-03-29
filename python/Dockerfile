FROM python:3.12-slim

WORKDIR /app

RUN addgroup --system pyuser && adduser --system --ingroup pyuser pyuser

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R pyuser:pyuser /app
USER pyuser

CMD ["python", "main.py"]
